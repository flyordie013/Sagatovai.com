#!/usr/bin/env bash
#
# OQU restore: puts a backup made by scripts/backup.sh back in place.
#
#   scripts/restore.sh --list
#   scripts/restore.sh --db /var/backups/oqu/daily/db-2026-08-05_03-30.sql.gz
#   scripts/restore.sh --videos /var/backups/oqu/daily/videos-2026-08-05_03-30.tar
#
# Run by a human, not by cron: it asks for confirmation unless --yes is given.
# Before touching the database it dumps the current one, so even a restore from
# the wrong file can be undone.
set -euo pipefail
# The safety dump written below holds every student's email and password hash —
# same reason backup.sh does this: 0600 files, 0700 directories, readable only
# by the account running the restore.
umask 077

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin${PATH:+:$PATH}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
fail() {
  printf '%s  ✗ %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
  exit 1
}

usage() {
  cat <<'TXT'
Восстановление OQU из резервной копии.

  scripts/restore.sh --list                  показать доступные копии
  scripts/restore.sh --db ФАЙЛ.sql.gz        восстановить базу
  scripts/restore.sh --videos ФАЙЛ.tar       восстановить видео
  scripts/restore.sh --db ФАЙЛ --videos ФАЙЛ восстановить всё
  --yes                                      не спрашивать подтверждение

Что происходит при восстановлении базы:
  1. проверяется, что файл копии целый;
  2. текущая база сохраняется в отдельный файл (на случай ошибки);
  3. сайт останавливается, база заливается заново, сайт запускается;
  4. проверяется /api/health.

Видео из архива распаковываются поверх существующих: ничего не удаляется.
TXT
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

setting() {
  local from_env="$1" key="$2" fallback="$3" value
  value="${from_env:-$(env_value "$key")}"
  printf '%s' "${value:-$fallback}"
}

DB_FILE=""
VIDEO_FILE=""
ASSUME_YES="no"
DO_LIST="no"

while [ $# -gt 0 ]; do
  case "$1" in
    --list)
      DO_LIST="yes"
      shift
      ;;
    --db)
      DB_FILE="${2:-}"
      shift 2 || fail "--db без имени файла"
      ;;
    --videos)
      VIDEO_FILE="${2:-}"
      shift 2 || fail "--videos без имени файла"
      ;;
    --yes | -y)
      ASSUME_YES="yes"
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *) fail "Неизвестный параметр: $1 (см. --help)" ;;
  esac
done

BACKUP_DIR="$(setting "${OQU_BACKUP_DIR:-}" OQU_BACKUP_DIR /var/backups/oqu)"
PGUSER_NAME="$(setting "" POSTGRES_USER oqu)"
PGDB_NAME="$(setting "" POSTGRES_DB oqu)"
APP_PORT="$(setting "${APP_PORT:-}" APP_PORT 3000)"
HEALTH_URL="http://127.0.0.1:${APP_PORT}/api/health"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  COMPOSE=() # --list works without Docker; restoring does not
fi
dc() { (cd "$PROJECT_DIR" && "${COMPOSE[@]}" "$@"); }
require_compose() {
  [ ${#COMPOSE[@]} -gt 0 ] || fail "Docker Compose не найден (ожидается «docker compose»)."
}

human() {
  awk -v b="${1:-0}" 'BEGIN {
    split("B KB MB GB TB", u, " "); i = 1
    while (b >= 1024 && i < 5) { b /= 1024; i++ }
    printf (i == 1 ? "%d %s" : "%.1f %s"), b, u[i]
  }'
}

file_size() { wc -c <"$1" | tr -d ' '; }

# "Когда сделана копия" — GNU date on the server, BSD fallback for a Mac.
mtime_h() {
  local t
  t="$(date -r "$1" '+%s' 2>/dev/null || stat -f '%m' "$1" 2>/dev/null || printf '0')"
  date -d "@${t}" '+%Y-%m-%d %H:%M' 2>/dev/null ||
    date -r "$t" '+%Y-%m-%d %H:%M' 2>/dev/null || printf '?'
}

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

wait_health() {
  local tries=0
  while [ "$tries" -lt 24 ]; do # up to 2 minutes
    check_health && return 0
    sleep 5
    tries=$((tries + 1))
  done
  return 1
}

confirm() {
  [ "$ASSUME_YES" = "yes" ] && return 0
  [ -t 0 ] || fail "Нет подтверждения. Запустите вручную или добавьте --yes."
  printf '%s\nНапишите ДА и нажмите Enter: ' "$1"
  local answer
  read -r answer
  [ "$answer" = "ДА" ] || fail "Отменено."
}

if [ "$DO_LIST" = "yes" ]; then
  printf 'Копии в %s:\n\n' "$BACKUP_DIR"
  found="no"
  for dir in "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly"; do
    [ -d "$dir" ] || continue
    printf '%s:\n' "$dir"
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      found="yes"
      printf '  %-40s %10s  %s\n' "$(basename "$f")" "$(human "$(file_size "$f")")" \
        "$(mtime_h "$f")"
    done < <(find "$dir" -maxdepth 1 -type f \( -name 'db-*.sql.gz' -o -name 'videos-*.tar' \) | sort -r)
    printf '\n'
  done
  [ "$found" = "yes" ] || printf 'Копий нет. Включите бэкапы: %s/scripts/install-cron.sh\n' "$PROJECT_DIR"
  exit 0
fi

[ -n "$DB_FILE" ] || [ -n "$VIDEO_FILE" ] || {
  usage
  exit 1
}

# ---------- база ----------
if [ -n "$DB_FILE" ]; then
  [ -f "$DB_FILE" ] || fail "Файл не найден: $DB_FILE"
  log "Проверяю файл копии…"
  gzip -t "$DB_FILE" 2>/dev/null || fail "Архив повреждён: $DB_FILE"
  trailer="$(gzip -dc "$DB_FILE" | tail -n 5 || true)"
  case "$trailer" in
    *"PostgreSQL database dump complete"*) ;;
    *) fail "Это не целый дамп базы (нет отметки о завершении): $DB_FILE" ;;
  esac
  log "✓ Файл целый ($(human "$(file_size "$DB_FILE")"), от $(mtime_h "$DB_FILE"))"

  confirm "ВНИМАНИЕ: текущие данные базы «${PGDB_NAME}» будут заменены копией от $(mtime_h "$DB_FILE")."

  require_compose
  [ -n "$(dc ps -q db 2>/dev/null || true)" ] ||
    fail "Контейнер базы не запущен. Запустите: cd ${PROJECT_DIR} && docker compose up -d db"

  # Safety net: whatever is in the database right now goes into its own file
  # first, so a restore from the wrong copy is still reversible.
  safety="${BACKUP_DIR}/pre-restore-$(date '+%Y-%m-%d_%H-%M').sql.gz"
  mkdir -p "$BACKUP_DIR"
  log "Сохраняю текущее состояние базы в $(basename "$safety")…"
  if dc exec -T db pg_dump -U "$PGUSER_NAME" -d "$PGDB_NAME" \
    --clean --if-exists --no-owner --no-privileges 2>/dev/null | gzip -c >"$safety"; then
    log "✓ Текущая база сохранена: $safety"
  else
    rm -f "$safety"
    log "! Текущую базу сохранить не удалось (возможно, она уже сломана)."
    confirm "Продолжить восстановление без страховочной копии?"
  fi

  log "Останавливаю приложение на время восстановления…"
  dc stop app >/dev/null 2>&1 || true

  log "Заливаю копию в базу…"
  # --single-transaction: either the whole copy lands, or the database is left
  # exactly as it was. No half-restored state.
  if ! gzip -dc "$DB_FILE" | dc exec -T db psql -U "$PGUSER_NAME" -d "$PGDB_NAME" \
    -v ON_ERROR_STOP=1 --single-transaction -q; then
    dc up -d app >/dev/null 2>&1 || true
    fail "Восстановление не удалось, база осталась прежней. Копия текущего состояния: ${safety}"
  fi
  log "✓ База восстановлена"

  log "Запускаю приложение…"
  dc up -d app >/dev/null
fi

# ---------- видео ----------
if [ -n "$VIDEO_FILE" ]; then
  [ -f "$VIDEO_FILE" ] || fail "Файл не найден: $VIDEO_FILE"
  tar -tf "$VIDEO_FILE" >/dev/null 2>&1 || fail "Архив видео не читается: $VIDEO_FILE"
  log "✓ Архив видео целый ($(human "$(file_size "$VIDEO_FILE")"))"

  confirm "Видео из копии будут распакованы поверх существующих (ничего не удаляется)."

  require_compose
  dc up -d app >/dev/null
  [ -n "$(dc ps -q app 2>/dev/null || true)" ] || fail "Контейнер приложения не запущен."

  log "Распаковываю видео…"
  dc exec -T app tar -xf - -C /app/storage <"$VIDEO_FILE" ||
    fail "Не удалось распаковать архив видео."
  log "✓ Видео восстановлены"
fi

# ---------- проверка ----------
log "Проверяю сайт (${HEALTH_URL})…"
if wait_health; then
  log "✓ Готово. Сайт отвечает, восстановление завершено."
else
  fail "Сайт не отвечает. Смотрите логи: cd ${PROJECT_DIR} && docker compose logs --tail=100 app"
fi
