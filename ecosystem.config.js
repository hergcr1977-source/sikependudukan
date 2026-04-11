module.exports = {
  apps: [
    {
      name: 'sikependudukan',
      script: 'npx',
      args: 'next start -p 3000',
      cwd: '/home/z/my-project',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: '/home/z/my-project/logs/pm2-error.log',
      out_file: '/home/z/my-project/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      restart_delay: 3000,
    },
    {
      name: 'backup-db',
      script: '/home/z/my-project/scripts/scheduler-backup.js',
      cwd: '/home/z/my-project',
      instances: 1,
      autorestart: true,
      watch: false,
      error_file: '/home/z/my-project/logs/backup-error.log',
      out_file: '/home/z/my-project/logs/backup-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      restart_delay: 60000,
    },
  ],
};
