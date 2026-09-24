#!/usr/bin/env bash
# Put a database file (e.g. downloaded from the old Railway app) into the app volume.
#   bash deploy/restore.sh ~/calotrack.db
set -euo pipefail
SRC="${1:?Укажите путь к файлу базы, например ~/calotrack.db}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
sudo docker compose stop app
sudo docker compose run --rm --no-deps -v "$(realpath "$SRC"):/restore.db:ro" --entrypoint sh app -c \
  'mkdir -p /data/backups && [ -f /data/calotrack.db ] && cp /data/calotrack.db /data/backups/before-restore-$(date +%s).db; cp /restore.db /data/calotrack.db && rm -f /data/calotrack.db-wal /data/calotrack.db-shm'
sudo docker compose start app
echo "База восстановлена. Миграции применятся при запуске — смотрите: sudo docker compose logs -f app"
