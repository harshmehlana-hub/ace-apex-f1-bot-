import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;
const backupDir = path.resolve(process.argv[2] || '');
if (!uri) throw new Error('MONGODB_URI is not configured.');
if (!backupDir) throw new Error('Usage: npm run restore -- ./backups/YYYY-MM-DDTHH-MM-SS-sssZ');
if (process.env.ALLOW_RESTORE !== 'YES') throw new Error('Set ALLOW_RESTORE=YES to confirm a destructive restore.');

const stat = await fs.stat(backupDir).catch(() => null);
if (!stat?.isDirectory()) throw new Error(`Backup directory not found: ${backupDir}`);

await mongoose.connect(uri);
const databaseName = mongoose.connection.db.databaseName;
await mongoose.disconnect();

const databaseBackupDir = path.join(backupDir, databaseName);
const backupStat = await fs.stat(databaseBackupDir).catch(() => null);
if (!backupStat?.isDirectory()) {
  throw new Error(`BSON backup for database '${databaseName}' was not found at ${databaseBackupDir}`);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.on('error', error => reject(new Error(`Could not start ${command}. Make sure MongoDB Database Tools are installed and on PATH.\n${error.message}`)));
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}.`)));
  });
}

await run('mongorestore', [
  `--uri=${uri}`,
  `--nsInclude=${databaseName}.*`,
  '--drop',
  '--gzip',
  databaseBackupDir,
]);

console.log(`BSON restore completed from ${databaseBackupDir}`);
