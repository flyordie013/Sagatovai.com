#!/usr/bin/env bash
#
# Safe update of a running OQU: backup → build → migrate → switch → verify.
#
#   scripts/update.sh              обновить до последней версии из git
#   scripts/update.sh --no-pull    обновить из того, что уже лежит на сервере
#   scripts/update.sh --yes        без вопросов (для скриптов)
#
# Nothing is switched over until a verified database backup exists, the new
# image has been built, and the migrations have gone through. The old container
# keeps serving the site for all of that time.
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin${PATH:+:$PATH}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"

log() { printf '\n%s  %s\n' "$(date '+%H:%M:%S')" "$*"; }
fail() {
  printf '\n%s  ✗ %s\n' "$(date '+%H:%M:%S')" "$*" >&2
  exit 1
}

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

DO_PULL="yes"
ASSUME_YES="no"
RUN_MIGRATE_STEP="yes"
while [ $# -gt 0 ]; do
  case "$1" in
    --no-pull) DO_PULL="no" ;;
    --yes | -y) ASSUME_YES="yes" ;;
    --skip-migrate-step) RUN_MIGRATE_STEP="no" ;;
    -h | --help)
      cat <<'TXT'
Безопасное обновление OQU: бэкап → сборка → миграции → переключение → проверка.

  scripts/update.sh                    обновить до последней версии из git
  scripts/update.sh --no-pull          обновить из того, что уже лежит на сервере
  scripts/update.sh --yes              не спрашивать подтверждение
  scripts/update.sh --skip-migrate-step  не применять миграции отдельным шагом

Пока новая версия не собралась и миграции не прошли, сайт продолжает работать
на прежней версии. Копия базы делается ДО всего остального; если её не удалось
создать, обновление не начнётся.
TXT
      exit 0
      ;;
    *) fail "Неизвестный параметр: $1 (см. --help)" ;;
  esac
  shift
done

BACKUP_DIR="${OQU_BACKUP_DIR:-$(env_value OQU_BACKUP_DIR)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/oqu}"
APP_PORT="${APP_PORT:-$(env_value APP_PORT)}"
APP_PORT="${APP_PORT:-3000}"
HEALTH_URL="http://127.0.0.1:${APP_PORT}/api/health"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  fail "Docker Compose не найден (ожидается «docker compose»)."
fi
dc() { (cd "$PROJECT_DIR" && "${COMPOSE[@]}" "$@"); }

check_health() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time 10 "$HEALTH_URL" 2>/dev/null | grep -q '"ok":true'
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- --timeout=10 "$HEALTH_URL" 2>/dev/null | grep -q '"ok":true'
  else
    [ "$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
      "$(dc ps -q app)" 2>/dev/null || true)" = "healthy" ]
  fi
}

newest_dump() {
  find "${BACKUP_DIR}/daily" -maxdepth 1 -type f -name 'db-*.sql.gz' 2>/dev/null | sort -r | head -n1
}

[ -f "${PROJECT_DIR}/docker-compose.yml" ] || fail "Не найден ${PROJECT_DIR}/docker-compose.yml"
[ -f "$ENV_FILE" ] || fail "Не найден ${ENV_FILE} — без него обновляться нельзя."

if [ "$ASSUME_YES" != "yes" ] && [ -t 0 ]; then
  printf 'Обновление OQU в %s. Сайт будет недоступен около минуты.\n' "$PROJECT_DIR"
  printf 'Продолжить? [y/N]: '
  read -r answer
  case "$answer" in y | Y | yes | Yes | да | ДА | д) ;; *) fail "Отменено." ;; esac
fi

# Tell the 5-minute self-check to stand down: the short outage while the
# container is replaced is expected, not a crash to be "fixed" mid-update.
UPDATE_FLAG="/var/tmp/oqu-update-in-progress"
touch "$UPDATE_FLAG" 2>/dev/null || true
trap 'rm -f "$UPDATE_FLAG"' EXIT

# ---------- 1. бэкап ----------
log "Шаг 1/5. Резервная копия базы перед обновлением"
before_dump="$(newest_dump)"
"${SCRIPT_DIR}/backup.sh" --db-only || fail "Бэкап не сделан — обновление отменено."
after_dump="$(newest_dump)"
[ -n "$after_dump" ] && [ "$after_dump" != "$before_dump" ] ||
  fail "Файл бэкапа не появился — обновление отменено. Проверьте ${BACKUP_DIR}."
log "✓ Копия на месте: ${after_dump}"

# ---------- 2. код ----------
old_commit=""
if command -v git >/dev/null 2>&1 && [ -d "${PROJECT_DIR}/.git" ]; then
  old_commit="$(cd "$PROJECT_DIR" && git rev-parse --short HEAD 2>/dev/null || true)"
fi
if [ "$DO_PULL" = "yes" ]; then
  log "Шаг 2/5. Забираю новую версию кода"
  [ -n "$old_commit" ] || fail "Это не git-копия проекта — запустите с --no-pull."
  (cd "$PROJECT_DIR" && git pull --ff-only) || fail "git pull не удался — обновление отменено."
  log "✓ Код обновлён: ${old_commit} → $(cd "$PROJECT_DIR" && git rev-parse --short HEAD)"
else
  log "Шаг 2/5. Пропущено (--no-pull)"
fi

rollback_hint() {
  printf '\nЧто делать:\n'
  printf '  1. Посмотрите ошибку: cd %s && docker compose logs --tail=100 app\n' "$PROJECT_DIR"
  if [ -n "$old_commit" ] && [ "$DO_PULL" = "yes" ]; then
    printf '  2. Вернуть прежнюю версию: cd %s && git checkout %s && docker compose up -d --build\n' \
      "$PROJECT_DIR" "$old_commit"
  else
    printf '  2. Вернуть прежнюю версию: cd %s && git checkout <прежний коммит> && docker compose up -d --build\n' \
      "$PROJECT_DIR"
  fi
  printf '  3. Если пострадали данные: %s/restore.sh --db %s\n' "$SCRIPT_DIR" "${after_dump:-ФАЙЛ_КОПИИ}"
}

# ---------- 3. сборка ----------
log "Шаг 3/5. Собираю новую версию (сайт пока работает на старой)"
dc build app || {
  printf '\n✗ Сборка не удалась. Сайт продолжает работать на прежней версии — ничего не сломано.\n'
  exit 1
}
log "✓ Собрано"

# ---------- 4. миграции ----------
if [ "$RUN_MIGRATE_STEP" = "yes" ]; then
  log "Шаг 4/5. Применяю миграции базы отдельным шагом"
  # A throwaway container of the NEW image applies the migrations through the
  # app's own migrator (same code path as boot, same advisory lock) and exits.
  # If a migration is broken, we find out here — before the live container is
  # replaced, and with the backup from step 1 still fresh.
  migrate_js='const t0 = Date.now();
require("./server.js");
const port = process.env.PORT || 3000;
const poll = async () => {
  try {
    const r = await fetch("http://127.0.0.1:" + port + "/api/health");
    if ((await r.json()).ok) { console.log("migrations ok"); process.exit(0); }
  } catch (err) { /* server still starting */ }
  if (Date.now() - t0 > 180000) { console.error("timeout"); process.exit(1); }
  setTimeout(poll, 2000);
};
setTimeout(poll, 1000);'
  if ! dc run --rm -T app node -e "$migrate_js"; then
    printf '\n✗ Миграции не применились. Сайт продолжает работать на прежней версии.\n'
    printf '  База не пострадала: каждая миграция выполняется одной транзакцией.\n'
    rollback_hint
    printf '  Если уверены, что дело не в миграциях: scripts/update.sh --no-pull --skip-migrate-step\n'
    exit 1
  fi
  log "✓ Миграции применены"
else
  log "Шаг 4/5. Пропущено (--skip-migrate-step): миграции применятся при старте контейнера"
fi

# ---------- 5. переключение ----------
log "Шаг 5/5. Переключаю сайт на новую версию"
dc up -d --remove-orphans || {
  printf '\n✗ Не удалось запустить новую версию.\n'
  rollback_hint
  exit 1
}

printf '  жду ответа сайта'
tries=0
while [ "$tries" -lt 24 ]; do # up to 2 minutes
  if check_health; then
    printf '\n'
    log "✓ Готово. Сайт работает: $(env_value APP_URL)"
    printf '  Копия перед обновлением: %s\n' "$after_dump"
    exit 0
  fi
  printf '.'
  sleep 5
  tries=$((tries + 1))
done

printf '\n✗ Новая версия запустилась, но сайт не отвечает на %s\n' "$HEALTH_URL"
rollback_hint
exit 1
