#!/bin/bash
# Daily backup: tar novel data + pg_dump. Add to crontab: 0 3 * * * /path/to/backup.sh
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/novelsaas}"
DATA_DIR="${DATA_DIR:-/data/projects}"
DB_NAME="${DB_NAME:-novelsaas}"
DB_USER="${DB_USER:-novel}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RETENTION_DAYS="${RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

# Backup novel data (YAML + MD files)
tar -czf "$BACKUP_DIR/novel-data-$TIMESTAMP.tar.gz" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")" 2>/dev/null || true

# Backup PostgreSQL
pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$BACKUP_DIR/db-$TIMESTAMP.dump" 2>/dev/null || true

# Cleanup old backups
find "$BACKUP_DIR" -name "*.tar.gz" -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "*.dump" -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true

echo "Backup complete: $(ls "$BACKUP_DIR" | wc -l) files in $BACKUP_DIR"
