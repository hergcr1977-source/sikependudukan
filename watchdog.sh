#!/bin/sh
LOG=/tmp/watchdog.log
SRVLOG=/tmp/next-server.log
PROJECT=/home/z/my-project

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Watchdog started" >> $LOG

while true; do
  RESP=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://localhost:3000 2>/dev/null)
  
  if [ "$RESP" != "200" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server down (HTTP=$RESP), restarting..." >> $LOG
    
    # Kill hanya next dev, bukan semua node process
    # Cari PID yang listen di port 3000
    PORT_PID=$(ss -tlnp 2>/dev/null | rg ":3000" | rg -oP "pid=\K[0-9]+" | head -1)
    if [ -n "$PORT_PID" ]; then
      kill -9 $PORT_PID 2>/dev/null
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Killed PID=$PORT_PID" >> $LOG
    fi
    
    # Juga kill child process next dev
    pgrep -f "next-server\|turbopack" 2>/dev/null | xargs kill -9 2>/dev/null
    
    sleep 3
    
    cd $PROJECT
    nohup npx next dev --port 3000 > $SRVLOG 2>&1 &
    SRVPID=$!
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Started PID=$SRVPID" >> $LOG
    
    for i in 1 2 3 4 5 6; do
      sleep 5
      R=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://localhost:3000 2>/dev/null)
      if [ "$R" = "200" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server ready" >> $LOG
        break
      fi
    done
  fi
  
  sleep 20
done
