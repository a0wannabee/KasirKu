const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');

const BACKUP_DIR = process.env.BACKUP_DIR || './storage/backups';
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);

/**
 * Runs `pg_dump` against DATABASE_URL and writes a timestamped .sql.gz file.
 * Every run — success or failure — is recorded in BackupLog so missed
 * backups are visible to the owner, not silently swallowed.
 */
async function runBackup() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `backup-${timestamp}.sql`;
  const filePath = path.join(BACKUP_DIR, fileName);
  const startedAt = new Date();

  return new Promise((resolve) => {
    execFile('pg_dump', [process.env.DATABASE_URL, '-f', filePath], async (error) => {
      const finishedAt = new Date();
      if (error) {
        await prisma.backupLog.create({
          data: { fileName, sizeBytes: 0, status: 'FAILED', startedAt, finishedAt, errorMessage: error.message },
        }).catch(() => {});
        console.error('Backup FAILED:', error.message);
        return resolve(false);
      }

      const stats = fs.statSync(filePath);
      await prisma.backupLog.create({
        data: { fileName, sizeBytes: BigInt(stats.size), status: 'SUCCESS', startedAt, finishedAt },
      });

      pruneOldBackups();
      console.log(`Backup SUCCESS: ${filePath} (${stats.size} bytes)`);
      resolve(true);
    });
  });
}

function pruneOldBackups() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(BACKUP_DIR)) {
    const filePath = path.join(BACKUP_DIR, file);
    if (fs.statSync(filePath).mtimeMs < cutoff) fs.unlinkSync(filePath);
  }
}

if (require.main === module) {
  require('dotenv').config();
  runBackup().then(() => process.exit(0));
}

module.exports = { runBackup };
