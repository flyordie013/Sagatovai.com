#!/usr/bin/env bash
#
# Turns on the two scheduled jobs OQU needs, in one command:
#   03:30 every night — backup (database + videos)
#   every 5 minutes   — self-check that restarts the app if it stopped answering
#
#   scripts/install-cron.sh            install (safe to re-run)
#   scripts/install-cron.sh --remove   remove both jobs
#
# Only lines tagged "# oqu-cron" are ever touched; the rest of the crontab is
# left exactly as it was.
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin${PATH:+:$PATH}"

# Everything under the backup folder (dumps with student emails and password
# hashes, video archives, logs) must stay readable by its owner only.
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"
TAG="# oqu-cron"

fail() {
  printf '✗ %s\n' "$*" >&2
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

BACKUP_DIR="${OQU_BACKUP_DIR:-$(env_value OQU_BACKUP_DIR)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/oqu}"

command -v crontab >/dev/null 2>&1 ||
  fail "Команда crontab не найдена. Установите: sudo apt install -y cron"

chmod +x "${SCRIPT_DIR}"/*.sh 2>/dev/null || true

BACKUP_LINE="30 3 * * * ${SCRIPT_DIR}/backup.sh >> ${BACKUP_DIR}/backup.log 2>&1 ${TAG}"
HEALTH_LINE="*/5 * * * * ${SCRIPT_DIR}/healthcheck.sh >> ${BACKUP_DIR}/healthcheck.log 2>&1 ${TAG}"

current="$(crontab -l 2>/dev/null || true)"
cleaned="$(printf '%s\n' "$current" | grep -v -F "$TAG" || true)"

if [ "${1:-}" = "--remove" ]; then
  printf '%s\n' "$cleaned" | crontab -
  printf '✓ Автоматические бэкапы и самопроверка выключены.\n'
  printf '  Уже сделанные копии остались в %s — они не удалены.\n' "$BACKUP_DIR"
  exit 0
fi

[ -z "${1:-}" ] || fail "Неизвестный параметр: $1 (доступно только --remove)"

mkdir -p "$BACKUP_DIR" 2>/dev/null ||
  fail "Не удалось создать папку ${BACKUP_DIR}. Запустите от root (sudo) или задайте OQU_BACKUP_DIR."
chmod 700 "$BACKUP_DIR" 2>/dev/null || true

# The two log files are created by cron's own shell (the `>>` in the two lines
# above), which uses cron's umask, not ours — so create them here, with the
# right permissions, before cron ever gets to touch them. `>>` never truncates,
# so re-running this script keeps the existing journals intact.
for log in backup.log healthcheck.log; do
  : >>"${BACKUP_DIR}/${log}" 2>/dev/null || true
  chmod 600 "${BACKUP_DIR}/${log}" 2>/dev/null || true
done

{
  # Keep the rest of the crontab byte-for-byte; only our two lines are added.
  [ -n "$cleaned" ] && printf '%s\n' "$cleaned"
  printf '%s\n%s\n' "$BACKUP_LINE" "$HEALTH_LINE"
} | crontab -

printf '✓ Расписание включено:\n'
printf '    каждую ночь в 03:30 — бэкап базы и видео\n'
printf '    каждые 5 минут      — проверка, что сайт жив (упал — перезапустим)\n\n'
printf 'Куда всё складывается:\n'
printf '    копии   %s/daily и %s/weekly\n' "$BACKUP_DIR" "$BACKUP_DIR"
printf '    журнал  %s/backup.log и %s/healthcheck.log\n\n' "$BACKUP_DIR" "$BACKUP_DIR"

# A schedule nobody tested is a schedule that fails at 3am. Prove it works now.
printf 'Пробный бэкап базы (проверяем, что всё настроено верно)…\n\n'
if "${SCRIPT_DIR}/backup.sh" --db-only; then
  printf '\n✓ Готово. Проверить состояние в любой момент: %s/backup.sh --status\n' "$SCRIPT_DIR"
else
  printf '\n✗ Пробный бэкап не удался — расписание включено, но сначала устраните ошибку выше.\n'
  exit 1
fi
