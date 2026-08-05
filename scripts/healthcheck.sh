#!/usr/bin/env bash
#
# OQU self-check: asks /api/health and, if the site is really down, restarts the
# container and writes what happened to the log. Meant for cron every 5 minutes.
#
#   scripts/healthcheck.sh            check (and repair if needed)
#   scripts/healthcheck.sh --status   when the site last answered
#
# This is a local safety net, not monitoring: if the whole server dies, nothing
# here runs. Set up external monitoring too — see the "Мониторинг" section of
# DEPLOY.md.
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin${PATH:+:$PATH}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"
STATE_DIR="/var/tmp"
LAST_OK_FILE="${STATE_DIR}/oqu-healthcheck.last-ok"
LAST_RESTART_FILE="${STATE_DIR}/oqu-healthcheck.last-restart"
# Never restart more often than this — a crash-looping container must not be
# kicked every five minutes, that only hides the real problem.
MIN_RESTART_INTERVAL=900

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

env_value() {
  local key="$1" line
  [ -f "$ENV_FILE" ] || return 0
  line="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" 2>/dev/null | tail -n1 || true)"
  [ -n "$line" ] || return 0
  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s' "$line"
}

APP_PORT="${APP_PORT:-$(env_value APP_PORT)}"
APP_PORT="${APP_PORT:-3000}"
HEALTH_URL="http://127.0.0.1:${APP_PORT}/api/health"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  COMPOSE=()
fi
dc() { (cd "$PROJECT_DIR" && "${COMPOSE[@]}" "$@"); }

check_health() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time 10 "$HEALTH_URL" 2>/dev/null | grep -q '"ok":true'
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- --timeout=10 "$HEALTH_URL" 2>/dev/null | grep -q '"ok":true'
  else
    log "! Ни curl, ни wget не установлены — проверить сайт нечем."
    return 2
  fi
}

if [ "${1:-}" = "--status" ]; then
  if [ -f "$LAST_OK_FILE" ]; then
    printf 'Последний успешный ответ сайта: %s\n' "$(cat "$LAST_OK_FILE")"
  else
    printf 'Самопроверка ещё ни разу не видела сайт живым (или не запускалась).\n'
  fi
  if [ -f "$LAST_RESTART_FILE" ]; then
    t="$(cat "$LAST_RESTART_FILE")"
    printf 'Последний автоматический перезапуск: %s\n' \
      "$(date -d "@${t}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null ||
        date -r "$t" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || printf '%s' "$t")"
  else
    printf 'Автоматических перезапусков не было.\n'
  fi
  if check_health; then
    printf '✓ Сейчас сайт отвечает.\n'
    exit 0
  fi
  printf '✗ Сейчас сайт не отвечает.\n'
  exit 1
fi

# No way to ask the site how it feels → say nothing and change nothing. Treating
# "cannot check" as "site is down" would restart a perfectly healthy container
# on every cron tick.
if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
  log "! Ни curl, ни wget не установлены — самопроверка пропущена (установите curl)."
  exit 0
fi

# scripts/update.sh replaces the container on purpose; the short outage that
# causes is not something to "repair" from under it.
UPDATE_FLAG="${STATE_DIR}/oqu-update-in-progress"
mtime() { date -r "$1" '+%s' 2>/dev/null || stat -f '%m' "$1" 2>/dev/null || printf '0'; }
if [ -f "$UPDATE_FLAG" ] && [ $(($(date +%s) - $(mtime "$UPDATE_FLAG"))) -lt 1800 ]; then
  log "Идёт обновление платформы — проверка пропущена."
  exit 0
fi

# A single failed request means nothing: a long upload or a restart can eat one.
# Three misses in a row over half a minute is a real outage.
ok="no"
for attempt in 1 2 3; do
  if check_health; then
    ok="yes"
    break
  fi
  if [ "$attempt" -lt 3 ]; then sleep 10; fi
done

if [ "$ok" = "yes" ]; then
  date '+%Y-%m-%d %H:%M:%S' >"$LAST_OK_FILE" 2>/dev/null || true
  exit 0 # silence on success: the cron log stays readable
fi

log "✗ Сайт не отвечает (${HEALTH_URL})"

[ ${#COMPOSE[@]} -gt 0 ] || {
  log "  Docker Compose не найден — перезапустить нечем."
  exit 1
}

now="$(date +%s)"
last_restart="$(cat "$LAST_RESTART_FILE" 2>/dev/null || echo 0)"
case "$last_restart" in '' | *[!0-9]*) last_restart=0 ;; esac
if [ $((now - last_restart)) -lt "$MIN_RESTART_INTERVAL" ]; then
  log "  Перезапуск был $(((now - last_restart) / 60)) мин назад — не трогаю, разбирайтесь руками:"
  log "  cd ${PROJECT_DIR} && docker compose logs --tail=100 app"
  exit 1
fi
printf '%s' "$now" >"$LAST_RESTART_FILE" 2>/dev/null || true

if [ -z "$(dc ps -q app 2>/dev/null || true)" ]; then
  log "  Контейнер приложения не запущен — поднимаю заново."
  dc up -d >/dev/null 2>&1 || log "  ! docker compose up завершился с ошибкой"
else
  log "  Перезапускаю контейнер приложения."
  dc restart app >/dev/null 2>&1 || log "  ! docker compose restart завершился с ошибкой"
fi

tries=0
while [ "$tries" -lt 18 ]; do # up to 3 minutes
  sleep 10
  if check_health; then
    date '+%Y-%m-%d %H:%M:%S' >"$LAST_OK_FILE" 2>/dev/null || true
    log "✓ Сайт поднялся после перезапуска."
    exit 0
  fi
  tries=$((tries + 1))
done

log "✗ После перезапуска сайт всё ещё не отвечает. Последние строки лога:"
dc logs --tail=30 app 2>&1 | sed 's/^/    /' || true
exit 1
