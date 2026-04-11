#!/bin/bash
# Auto-restart server script untuk Sistem Data Kependudukan
# Menjalankan next dev dengan auto-restart jika crash

cd /home/z/my-project

while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting server..."
  
  npx next dev --port 3000 2>&1 | tee /tmp/next-server.log
  
  EXIT_CODE=${PIPESTATUS[0]}
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server stopped with exit code: $EXIT_CODE"
  
  # Tunggu 3 detik sebelum restart
  sleep 3
done
