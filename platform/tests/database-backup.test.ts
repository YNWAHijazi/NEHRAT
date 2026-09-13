import { spawnSync } from 'node:child_process';
import { mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

it('backs up committed WAL data and documents, restores independently, and refuses overwrite', () => {
  const directory = mkdtempSync(join(tmpdir(), 'moph-backup-test-'));
  const script = resolve('scripts/backup-database.mjs');
  // Keep the writer open so the committed rows are still in its WAL while backing up.
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { DatabaseSync } from 'node:sqlite';
    import { spawnSync } from 'node:child_process';
    import { copyFileSync, readFileSync } from 'node:fs';
    import assert from 'node:assert/strict';
    const root = process.env.TEST_BACKUP_DIR;
    const source = root + '/source.sqlite';
    const db = new DatabaseSync(source);
    db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE accounts(id INTEGER PRIMARY KEY, is_demo INTEGER); CREATE TABLE files(id INTEGER PRIMARY KEY, account_id INTEGER REFERENCES accounts(id), bytes BLOB);");
    db.prepare('INSERT INTO accounts VALUES (?, ?)').run(1, 0);
    db.prepare('INSERT INTO files VALUES (?, ?, ?)').run(1, 1, Buffer.from([0, 255, 10, 42]));
    const run = () => spawnSync(process.execPath, [process.env.TEST_BACKUP_SCRIPT, '--source', source, '--output-dir', root + '/snapshot'], {encoding: 'utf8'});
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    copyFileSync(root + '/snapshot/database.sqlite', root + '/restored.sqlite');
    const restored = new DatabaseSync(root + '/restored.sqlite', {readOnly: true});
    assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM accounts').get().n, 1);
    assert.deepEqual(Buffer.from(restored.prepare('SELECT bytes FROM files').get().bytes), Buffer.from([0, 255, 10, 42]));
    restored.close();
    assert.notEqual(run().status, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM files').get().n, 1);
    db.close();
    console.log(readFileSync(root + '/snapshot/manifest.json', 'utf8'));
  `], { encoding: 'utf8', env: { ...process.env, TEST_BACKUP_DIR: directory, TEST_BACKUP_SCRIPT: script } });
  expect(result.status, result.stderr).toBe(0);
  const manifest = JSON.parse(result.stdout);
  expect(manifest.integrity).toBe('ok');
  expect(manifest.foreignKeyErrors).toEqual([]);
  expect(manifest.tables.find((table: { name: string }) => table.name === 'files').blobs).toEqual([{ column: 'bytes', files: 1, bytes: 4 }]);
  expect(statSync(join(directory, 'snapshot/database.sqlite')).mode & 0o777).toBe(0o600);
});

it('refuses a nonexistent source instead of creating an empty database', () => {
  const directory = mkdtempSync(join(tmpdir(), 'moph-backup-missing-'));
  const result = spawnSync(process.execPath, ['scripts/backup-database.mjs', '--source', join(directory, 'missing.sqlite'), '--output-dir', join(directory, 'backup')], { encoding: 'utf8' });
  expect(result.status).not.toBe(0);
});
