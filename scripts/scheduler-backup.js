// Backup scheduler - runs daily backup at 02:00 WIB
const { execSync } = require('child_process');
const path = require('path');

function runBackup() {
  const script = path.join(__dirname, 'backup-db.sh');
  try {
    execSync(`bash ${script}`, { stdio: 'inherit' });
  } catch (error) {
    console.error('Backup failed:', error.message);
  }
}

// Run backup immediately on start
console.log('[Scheduler] Running initial backup...');
runBackup();

// Schedule: every day at 02:00 WIB (UTC+7 = 19:00 UTC previous day)
function scheduleNext() {
  const now = new Date();
  // Next 02:00 WIB = 19:00 UTC (previous day)
  const wibOffset = 7 * 60; // minutes
  const utcNow = now.getTime() + now.getTimezoneOffset() * 60000;
  const wibNow = new Date(utcNow + wibOffset * 60000);
  
  const next = new Date(wibNow);
  next.setHours(2, 0, 0, 0);
  if (next <= wibNow) {
    next.setDate(next.getDate() + 1);
  }
  
  const delayMs = next.getTime() - wibNow.getTime();
  const hoursUntil = Math.floor(delayMs / 3600000);
  const minsUntil = Math.floor((delayMs % 3600000) / 60000);
  console.log(`[Scheduler] Next backup in ${hoursUntil}h ${minsUntil}m (at 02:00 WIB)`);
  
  setTimeout(() => {
    console.log(`[Scheduler] Running scheduled backup at ${new Date().toISOString()}`);
    runBackup();
    scheduleNext(); // Schedule next one
  }, delayMs);
}

scheduleNext();

// Keep alive
setInterval(() => {}, 60000);
