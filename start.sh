#!/bin/bash
# Start Sistem Data Kependudukan dengan PM2
cd /home/z/my-project
PM2=/home/z/my-project/node_modules/.bin/pm2

# Kill zombie processes
pkill -9 -f "next-server" 2>/dev/null
sleep 2

# Start PM2
$PM2 start /home/z/my-project/ecosystem.config.js 2>&1
sleep 15

# Verify
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
if [ "$HTTP" = "200" ]; then
  echo "✅ Server aktif di http://localhost:3000"
else
  echo "⏳ Server sedang startup..."
  sleep 10
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
  echo "Status: HTTP $HTTP"
fi

$PM2 save >/dev/null 2>&1
echo "PM2: auto-restart aktif"
