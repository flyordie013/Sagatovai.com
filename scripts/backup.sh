#!/usr/bin/env bash
#
# OQU backup: a Postgres dump plus an archive of the uploaded videos.
#
#   scripts/backup.sh             full backup (database + videos)
#   scripts/backup.sh --db-only   database only (fast; used before an update)
#   scripts/backup.sh --status    when the last backup ran and what is stored
#
# Built for cron: absolute paths, no prompts, one instance at a time, and it
# never deletes anything except its own dated files inside the backup folder.
set -euo pipefail

# cron runs with an almost empty PATH; docker lives in /usr/bin or /usr/local/bin.
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
Резервная копия OQU — база данных и загруженные видео.

  scripts/backup.sh              полный бэкап (база + видео)
  scripts/backup.sh --db-only    только база (быстро, перед обновлением)
  scripts/backup.sh --status     показать, когда был последний бэкап
  scripts/backup.sh --help       эта справка

Куда складывать копии и сколько хранить — переменные OQU_BACKUP_DIR,
OQU_KEEP_DAILY, OQU_KEEP_WEEKLY, OQU_KEEP_VIDEO_DAILY, OQU_KEEP_VIDEO_WEEKLY
(можно задать в файле .env рядом с docker-compose.yml).
TXT
}

# Reads one KEY=value from .env without sourcing the file (values may contain
# characters the shell would happily interpret).
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

MODE="full"
case "${1:-}" in
  "") ;;
  --db-only) MODE="db-only" ;;
  --status) MODE="status" ;;
  -h | --help)
    usage
    exit 0
    ;;
  *) fail "Неизвестный параметр: $1 (см. --help)" ;;
esac

BACKUP_DIR="$(setting "${OQU_BACKUP_DIR:-}" OQU_BACKUP_DIR /var/backups/oqu)"
KEEP_DAILY="$(setting "${OQU_KEEP_DAILY:-}" OQU_KEEP_DAILY 7)"
KEEP_WEEKLY="$(setting "${OQU_KEEP_WEEKLY:-}" OQU_KEEP_WEEKLY 4)"
KEEP_VIDEO_DAILY="$(setting "${OQU_KEEP_VIDEO_DAILY:-}" OQU_KEEP_VIDEO_DAILY 2)"
KEEP_VIDEO_WEEKLY="$(setting "${OQU_KEEP_VIDEO_WEEKLY:-}" OQU_KEEP_VIDEO_WEEKLY 2)"
PGUSER_NAME="$(setting "" POSTGRES_USER oqu)"
PGDB_NAME="$(setting "" POSTGRES_DB oqu)"

DAILY_DIR="${BACKUP_DIR}/daily"
WEEKLY_DIR="${BACKUP_DIR}/weekly"
STAMP="$(date '+%Y-%m-%d_%H-%M')"
# Head-room left on the backup disk. Filling it would take the site down with
# it — the database and the videos live on the same disk.
RESERVE_BYTES=$((1024 * 1024 * 1024))
# A gzipped dump of an empty-but-valid database is still several KB; anything
# smaller means pg_dump produced nothing usable.
MIN_DUMP_BYTES=1024

mkdir -p "$DAILY_DIR" "$WEEKLY_DIR" 2>/dev/null ||
  fail "Не удалось создать папку ${BACKUP_DIR}. Запустите от root или задайте OQU_BACKUP_DIR."

human() { # bytes → "1.2 GB"
  awk -v b="${1:-0}" 'BEGIN {
    split("B KB MB GB TB", u, " "); i = 1
    while (b >= 1024 && i < 5) { b /= 1024; i++ }
    printf (i == 1 ? "%d %s" : "%.1f %s"), b, u[i]
  }'
}

file_size() { wc -c <"$1" | tr -d ' '; }

# Modification time in seconds. GNU date on the server; the BSD form keeps the
# script usable on a Mac.
mtime() { date -r "$1" '+%s' 2>/dev/null || stat -f '%m' "$1" 2>/dev/null || printf '0'; }

free_bytes() { df -Pk "$1" | awk 'NR == 2 { print $4 * 1024 }'; }

newest() { # newest file matching a pattern, or empty
  find "$1" -maxdepth 1 -type f -name "$2" 2>/dev/null | sort -r | head -n1
}

# Deletes the oldest files of one kind, keeping $3 of them. Scoped to a single
# directory and an exact name pattern — nothing else can ever be removed.
rotate() {
  local dir="$1" pattern="$2" keep="$3" file
  [ -d "$dir" ] || return 0
  find "$dir" -maxdepth 1 -type f -name "$pattern" 2>/dev/null | sort -r |
    tail -n "+$((keep + 1))" | while IFS= read -r file; do
    if rm -f -- "$file"; then log "  удалён старый файл $(basename "$file")"; fi
  done || true
}

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  COMPOSE=()
fi
dc() { (cd "$PROJECT_DIR" && "${COMPOSE[@]}" "$@"); }

# ---------- статус ----------
if [ "$MODE" = "status" ]; then
  last_db="$(newest "$DAILY_DIR" 'db-*.sql.gz')"
  if [ -z "$last_db" ]; then
    printf '✗ Бэкапов базы нет в %s\n' "$DAILY_DIR"
    printf '  Включите их: %s/scripts/install-cron.sh\n' "$PROJECT_DIR"
    exit 1
  fi
  age_h=$((($(date +%s) - $(mtime "$last_db")) / 3600))
  printf 'Папка бэкапов: %s (свободно %s)\n' "$BACKUP_DIR" "$(human "$(free_bytes "$BACKUP_DIR")")"
  printf 'Последний бэкап базы: %s, размер %s, возраст %s ч\n' \
    "$(basename "$last_db")" "$(human "$(file_size "$last_db")")" "$age_h"
  last_video="$(newest "$DAILY_DIR" 'videos-*.tar')"
  if [ -n "$last_video" ]; then
    printf 'Последний архив видео: %s, размер %s\n' \
      "$(basename "$last_video")" "$(human "$(file_size "$last_video")")"
  else
    printf 'Архивов видео пока нет\n'
  fi
  printf 'Суточных копий базы: %s, недельных: %s\n' \
    "$(find "$DAILY_DIR" -maxdepth 1 -type f -name 'db-*.sql.gz' | wc -l | tr -d ' ')" \
    "$(find "$WEEKLY_DIR" -maxdepth 1 -type f -name 'db-*.sql.gz' | wc -l | tr -d ' ')"
  if [ "$age_h" -gt 36 ]; then
    printf '✗ Свежего бэкапа нет больше полутора суток — проверьте cron.\n'
    exit 1
  fi
  printf '✓ Бэкапы делаются.\n'
  exit 0
fi

# ---------- бэкап ----------
[ ${#COMPOSE[@]} -gt 0 ] || fail "Docker Compose не найден (ожидается «docker compose»)."
[ -f "${PROJECT_DIR}/docker-compose.yml" ] || fail "Не найден ${PROJECT_DIR}/docker-compose.yml"

# One run at a time: a slow video archive must not overlap the next cron tick.
exec 9>"${BACKUP_DIR}/.backup.lock"
if command -v flock >/dev/null 2>&1; then
  flock -n 9 || {
    log "Бэкап уже выполняется — пропускаю запуск."
    exit 0
  }
fi

log "Бэкап OQU → ${BACKUP_DIR}"

# Leftovers from a run that was killed mid-write (a half-made video archive can
# be gigabytes). Only our own temp names, only here, only if long abandoned —
# the lock above already rules out a live run.
find "$DAILY_DIR" -maxdepth 1 -type f -name '.db-*.part*' -mmin +120 -delete 2>/dev/null || true
find "$DAILY_DIR" -maxdepth 1 -type f -name '.videos-*.part' -mmin +720 -delete 2>/dev/null || true

[ -n "$(dc ps -q db 2>/dev/null || true)" ] ||
  fail "Контейнер базы не запущен. Запустите: cd ${PROJECT_DIR} && docker compose up -d"

# --- база ---
dump_tmp="${DAILY_DIR}/.db-${STAMP}.sql.gz.part"
dump_final="${DAILY_DIR}/db-${STAMP}.sql.gz"
rm -f "$dump_tmp"

log "Снимаю дамп базы ${PGDB_NAME}…"
if ! dc exec -T db pg_dump -U "$PGUSER_NAME" -d "$PGDB_NAME" \
  --clean --if-exists --no-owner --no-privileges 2>"${dump_tmp}.err" | gzip -c >"$dump_tmp"; then
  err="$(tail -n3 "${dump_tmp}.err" 2>/dev/null || true)"
  rm -f "$dump_tmp" "${dump_tmp}.err"
  fail "pg_dump не отработал. Ответ базы: ${err:-нет вывода}"
fi
rm -f "${dump_tmp}.err"

# A backup nobody checked is not a backup: verify the archive opens and that
# pg_dump wrote its "dump complete" trailer (a truncated dump has no trailer).
dump_size="$(file_size "$dump_tmp")"
[ "$dump_size" -ge "$MIN_DUMP_BYTES" ] || {
  rm -f "$dump_tmp"
  fail "Дамп подозрительно мал (${dump_size} байт) — копия не сохранена."
}
gzip -t "$dump_tmp" 2>/dev/null || {
  rm -f "$dump_tmp"
  fail "Архив дампа повреждён — копия не сохранена."
}
trailer="$(gzip -dc "$dump_tmp" | tail -n 5 || true)"
case "$trailer" in
  *"PostgreSQL database dump complete"*) ;;
  *)
    rm -f "$dump_tmp"
    fail "Дамп оборвался на середине — копия не сохранена."
    ;;
esac

mv "$dump_tmp" "$dump_final"
log "✓ База: $(basename "$dump_final") ($(human "$dump_size"))"

# --- видео ---
video_final=""
if [ "$MODE" = "db-only" ]; then
  log "Видео пропущены (--db-only)."
else
  videos_bytes="$(dc exec -T app du -sb /app/storage 2>/dev/null | awk 'NR == 1 { print $1 }' || true)"
  case "$videos_bytes" in
    '' | *[!0-9]*) videos_bytes="" ;;
  esac
  free_now="$(free_bytes "$BACKUP_DIR")"

  if [ -z "$videos_bytes" ]; then
    log "! Не удалось измерить папку видео (контейнер app не запущен?) — архив видео пропущен."
  elif [ "$videos_bytes" -lt 1024 ]; then
    log "Видео ещё не загружены — архивировать нечего."
  elif [ "$free_now" -lt $((videos_bytes + RESERVE_BYTES)) ]; then
    # Filling the disk with a backup would break uploads and stop Postgres.
    log "! Мало места: видео занимают $(human "$videos_bytes"), свободно $(human "$free_now")."
    log "! Архив видео пропущен, дамп базы сохранён. Освободите место или копируйте видео на другой сервер."
  else
    video_tmp="${DAILY_DIR}/.videos-${STAMP}.tar.part"
    video_final="${DAILY_DIR}/videos-${STAMP}.tar"
    log "Архивирую видео ($(human "$videos_bytes"))…"
    # Plain tar, no gzip: mp4/webm are already compressed, so packing them
    # again would only burn CPU time for a percent or two.
    if ! dc exec -T app tar -cf - -C /app/storage . >"$video_tmp" 2>/dev/null; then
      rm -f "$video_tmp"
      fail "Не удалось заархивировать видео."
    fi
    if ! tar -tf "$video_tmp" >/dev/null 2>&1; then
      rm -f "$video_tmp"
      fail "Архив видео не читается — копия не сохранена."
    fi
    mv "$video_tmp" "$video_final"
    log "✓ Видео: $(basename "$video_final") ($(human "$(file_size "$video_final")"))"
  fi
fi

# --- недельная копия (воскресенье) ---
if [ "$(date +%u)" = "7" ]; then
  # Hard links: the weekly copy costs no extra disk space until the daily one
  # is rotated away.
  ln -f "$dump_final" "${WEEKLY_DIR}/$(basename "$dump_final")" 2>/dev/null ||
    cp -p "$dump_final" "${WEEKLY_DIR}/$(basename "$dump_final")"
  log "✓ Недельная копия базы сохранена"
  if [ -n "$video_final" ]; then
    ln -f "$video_final" "${WEEKLY_DIR}/$(basename "$video_final")" 2>/dev/null ||
      cp -p "$video_final" "${WEEKLY_DIR}/$(basename "$video_final")"
    log "✓ Недельная копия видео сохранена"
  fi
fi

# --- ротация ---
rotate "$DAILY_DIR" 'db-*.sql.gz' "$KEEP_DAILY"
rotate "$WEEKLY_DIR" 'db-*.sql.gz' "$KEEP_WEEKLY"
rotate "$DAILY_DIR" 'videos-*.tar' "$KEEP_VIDEO_DAILY"
rotate "$WEEKLY_DIR" 'videos-*.tar' "$KEEP_VIDEO_WEEKLY"

log "Готово. Свободно на диске: $(human "$(free_bytes "$BACKUP_DIR")")"
log "Восстановление: ${PROJECT_DIR}/scripts/restore.sh --db ${dump_final}"
