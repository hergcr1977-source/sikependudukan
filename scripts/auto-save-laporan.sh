#!/bin/bash
# Auto-save laporan bulanan tiap tanggal 1 awal bulan
# Menyimpan laporan bulan SEBELUMNYA (snapshot akhir bulan)

BASE_URL="http://localhost:3000"
LOG_FILE="/home/z/my-project/logs/auto-save-laporan.log"

mkdir -p /home/z/my-project/logs

# Hitung bulan & tahun lalu
PREV_MONTH=$(TZ=Asia/Jakarta date -d "1 month ago" '+%-m')
PREV_YEAR=$(TZ=Asia/Jakarta date -d "1 month ago" '+%Y')

TIMESTAMP=$(TZ=Asia/Jakarta date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] Auto-save laporan untuk bulan $PREV_MONTH/$PREV_YEAR" >> "$LOG_FILE"

# Panggil API save
RESPONSE=$(curl -s -X POST "$BASE_URL/api/laporan/save" \
  -H "Content-Type: application/json" \
  -d "{\"bulan\": $PREV_MONTH, \"tahun\": $PREV_YEAR}" 2>&1)

echo "[$TIMESTAMP] Response: $RESPONSE" >> "$LOG_FILE"
