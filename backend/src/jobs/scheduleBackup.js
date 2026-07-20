const cron = require('node-cron');
const { runBackup } = require('./backupDatabase');

// Default: every day at 02:00 server time. Configurable via BACKUP_CRON.
const schedule = process.env.BACKUP_CRON || '0 2 * * *';

cron.schedule(schedule, () => {
  console.log('Running scheduled database backup...');
  runBackup();
});

module.exports = {};
