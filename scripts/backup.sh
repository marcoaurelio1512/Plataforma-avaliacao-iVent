#!/usr/bin/env sh
# Backup lógico do PostgreSQL (formato custom, restaurável com pg_restore).
# Uso: DATABASE_URL=postgresql://... ./scripts/backup.sh [diretório]
# Restauração: pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" arquivo.dump
set -eu
: "${DATABASE_URL:?Defina DATABASE_URL}"
DIR="${1:-backups}"
mkdir -p "$DIR"
FILE="$DIR/ivent-avaliacao-$(date +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --no-owner --file="$FILE" "$DATABASE_URL"
echo "Backup salvo em $FILE"
