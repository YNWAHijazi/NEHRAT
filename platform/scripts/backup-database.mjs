/** Consistent SQLite snapshot, including WAL transactions and uploaded BLOBs.
 * Never imports the application: no migrations, seeding, or source writes.
 */
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  source: { type: 'string' },
  'output-dir': { type: 'string' },
} });
const sourcePath = values.source || process.env.DATABASE_PATH;
if (!sourcePath || !values['output-dir']) {
  throw new Error('Usage: node scripts/backup-database.mjs --source /path/database.db --output-dir /path/new-backup-directory (or set DATABASE_PATH).');
}
const source = realpathSync(sourcePath);
if (!statSync(source).isFile()) throw new Error('The source must be an existing database file.');
const output = resolve(values['output-dir']);
// Refuse to overwrite any existing directory or backup. Restrict private data at creation.
process.umask(0o077);
mkdirSync(output, { mode: 0o700 });
const snapshot = join(output, 'database.sqlite');
const input = new DatabaseSync(source, { readOnly: true });
try {
  input.exec('PRAGMA busy_timeout = 5000');
  input.prepare('VACUUM INTO ?').run(snapshot);
} finally {
  input.close();
}
chmodSync(snapshot, 0o600);

const copy = new DatabaseSync(snapshot, { readOnly: true });
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
let report;
try {
  const integrity = copy.prepare('PRAGMA integrity_check').all();
  if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok') {
    throw new Error('Snapshot integrity check failed; this backup is not verified.');
  }
  const foreignKeyErrors = copy.prepare('PRAGMA foreign_key_check').all();
  const schema = copy.prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all();
  const tables = schema.filter((item) => item.type === 'table').map(({ name }) => {
    const columns = copy.prepare('SELECT * FROM pragma_table_info(?)').all(name);
    const count = copy.prepare(`SELECT COUNT(*) AS count FROM ${quote(name)}`).get().count;
    const demoRows = columns.some((column) => column.name === 'is_demo')
      ? copy.prepare(`SELECT COUNT(*) AS count FROM ${quote(name)} WHERE is_demo = 1`).get().count : null;
    const blobs = columns.filter((column) => column.type.toUpperCase() === 'BLOB').map((column) => {
      const stats = copy.prepare(`SELECT COUNT(${quote(column.name)}) AS files, COALESCE(SUM(LENGTH(${quote(column.name)})), 0) AS bytes FROM ${quote(name)}`).get();
      return { column: column.name, ...stats };
    });
    return { name, rows: count, demoRows, columns, blobs };
  });
  report = {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    source,
    snapshot: 'database.sqlite',
    sha256: createHash('sha256').update(readFileSync(snapshot)).digest('hex'),
    integrity: 'ok',
    foreignKeyErrors,
    tables,
  };
  writeFileSync(join(output, 'schema.json'), JSON.stringify(schema, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  writeFileSync(join(output, 'manifest.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
} finally {
  copy.close();
}
if (report.foreignKeyErrors.length) {
  throw new Error(`Snapshot saved but ${report.foreignKeyErrors.length} foreign-key violations need review. See manifest.json; do not proceed with migration.`);
}
console.log(JSON.stringify({ directory: output, tables: report.tables.length, integrity: report.integrity, sha256: report.sha256 }));
