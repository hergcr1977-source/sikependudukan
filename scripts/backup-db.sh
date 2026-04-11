#!/bin/bash
# Backup database SQLite harian
# Menyimpan 30 backup terakhir (otomatis hapus yang lama)

BACKUP_DIR="/home/z/my-project/backup"
DB_FILE="/home/z/my-project/db/custom.db"
LOG_FILE="/home/z/my-project/logs/backup-db.log"
MAX_BACKUPS=30

mkdir -p "$BACKUP_DIR" /home/z/my-project/logs

# Cek apakah database ada
if [ ! -f "$DB_FILE" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') - ERROR: Database file tidak ditemukan di $DB_FILE" >> "$LOG_FILE"
  exit 1
fi

# Buat backup dengan timestamp
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="$BACKUP_DIR/custom_${TIMESTAMP}.db"

cp "$DB_FILE" "$BACKUP_FILE" 2>> "$LOG_FILE"

if [ $? -eq 0 ]; then
  FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "$(date '+%Y-%m-%d %H:%M:%S') - OK: Backup berhasil $BACKUP_FILE ($FILESIZE)" >> "$LOG_FILE"

  # Hapus backup lama, simpan hanya MAX_BACKUPS terakhir
  cd "$BACKUP_DIR"
  ls -t custom_*.db 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm --
  COUNT=$(ls custom_*.db 2>/dev/null | wc -l)
  echo "$(date '+%Y-%m-%d %H:%M:%S') - INFO: Total backup tersimpan: $COUNT file" >> "$LOG_FILE"
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') - ERROR: Gagal membuat backup" >> "$LOG_FILE"
  exit 1
fi
