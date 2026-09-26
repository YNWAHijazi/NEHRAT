/** Restore a verified snapshot to a NEW file; never open or replace the live database. */
import { DatabaseSync } from 'node:sqlite';
import { constants, copyFileSync, chmodSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  'backup-dir': { type: 'string' }, 'restore-path': { type: 'string' },
} });
if (!values['backup-dir'] || !values['restore-path']) {
  throw new Error('Use --backup-dir PATH --restore-path NEW_DATABASE_FILE');
}
const directory = realpathSync(values['backup-dir']);
const source = realpathSync(join(directory, 'database.sqlite'));
const destination = resolve(values['restore-path']);
const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (hash(readFileSync(source)) !== manifest.sha256) throw new Error('Backup hash does not match its manifest.');
if (manifest.integrity !== 'ok' || manifest.foreignKeyErrors.length) throw new Error('Backup was not verified.');
process.umask(0o077);
// COPYFILE_EXCL prevents accidental overwrites, including the live file or a symlink.
copyFileSync(source, destination, constants.COPYFILE_EXCL);
chmodSync(destination, 0o600);
const restored = new DatabaseSync(destination);
const quote = value => '"' + value.replaceAll('"', '""') + '"';
let blobs = 0;
try {
  if (hash(readFileSync(destination)) !== manifest.sha256) throw new Error('Restored bytes differ from the backup.');
  const integrity = restored.prepare('PRAGMA integrity_check').all();
  if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok') throw new Error('Restored database failed its integrity check.');
  if (restored.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Restored database has broken references.');
  for (const table of manifest.tables) {
    if (restored.prepare(`SELECT COUNT(*) AS n FROM ${quote(table.name)}`).get().n !== table.rows) {
      throw new Error(`Row count differs for ${table.name}.`);
    }
    for (const column of table.blobs) {
      const actual = restored.prepare(`SELECT COUNT(${quote(column.column)}) AS files, COALESCE(SUM(LENGTH(${quote(column.column)})), 0) AS bytes FROM ${quote(table.name)}`).get();
      if (actual.files !== column.files || actual.bytes !== column.bytes) throw new Error(`Files differ for ${table.name}.`);
      blobs += actual.files;
    }
  }
  // Prove the restored database can commit a write, then remove only this probe.
  restored.exec('CREATE TABLE __recovery_probe (value TEXT NOT NULL)');
  restored.prepare('INSERT INTO __recovery_probe VALUES (?)').run('restore verified');
} finally { restored.close(); }
const reopened = new DatabaseSync(destination);
try {
  if (reopened.prepare('SELECT value FROM __recovery_probe').get().value !== 'restore verified') throw new Error('Restore write did not persist.');
  reopened.exec('DROP TABLE __recovery_probe');
} finally { reopened.close(); }
const report = { checkedAt: new Date().toISOString(), backup: source, restoredCopy: destination,
  backupSha256: manifest.sha256, integrity: 'ok', tables: manifest.tables.length, storedFiles: blobs,
  committedWriteAndReopen: 'passed', liveDatabaseChanged: false };
writeFileSync(destination + '.recovery.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify(report));
