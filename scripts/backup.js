import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not configured.');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = path.resolve(process.argv[2] || './backups', timestamp);
await fs.mkdir(outputDir, { recursive: true });

await mongoose.connect(uri);
const databaseName = mongoose.connection.db.databaseName;
await mongoose.disconnect();

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.on('error', error => reject(new Error(`Could not start ${command}. Make sure MongoDB Database Tools are installed and on PATH.\n${error.message}`)));
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}.`)));
  });
}

await run('mongodump', [
  `--uri=${uri}`,
  `--db=${databaseName}`,
  `--out=${outputDir}`,
  '--gzip',
]);

console.log(`BSON backup written to ${path.join(outputDir, databaseName)}`);
