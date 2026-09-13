/** Read-only staging connection check. Never logs credentials or record contents. */
import pg from 'pg';
import { readFileSync } from 'node:fs';

const expectedProject = 'zdujmsnlvohidgjlrvqf';
for (const key of ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) {
  if (!process.env[key]) throw new Error(`Missing ${key} in the private staging configuration.`);
}
if (process.env.PGUSER !== `postgres.${expectedProject}` ||
    process.env.PGHOST !== 'aws-0-ap-northeast-2.pooler.supabase.com' ||
    process.env.PGPORT !== '5432' || process.env.PGDATABASE !== 'postgres') {
  throw new Error('Connection does not match the staging project supplied by the owner.');
}
const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: {
    rejectUnauthorized: true,
    ...(process.env.PGSSLROOTCERT ? { ca: readFileSync(process.env.PGSSLROOTCERT, 'utf8') } : {}),
  },
  connectionTimeoutMillis: 15000,
  statement_timeout: 15000,
  options: '-c default_transaction_read_only=on',
  application_name: 'nehrat-staging-inspection',
});
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const { rows: tables } = await client.query(`
    SELECT table_schema, table_name FROM information_schema.tables
    WHERE table_schema IN ('public', 'nehrat') AND table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name
  `);
  const { rows: tls } = await client.query('SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid()');
  await client.query('ROLLBACK');
  console.log(JSON.stringify({ connected: true, project: expectedProject,
    clientToPoolerTls: { encrypted: client.connection.stream.encrypted === true,
      certificateVerified: client.connection.stream.authorized === true },
    // pg_stat_ssl describes the pooler's backend session, not this client's TLS socket.
    poolerBackendTls: tls[0] ?? null, applicationTables: tables }, null, 2));
} catch (error) {
  // Do not echo server messages, connection objects, or environment values.
  console.error(JSON.stringify({ connected: false, errorCode: error.code ?? 'CONNECTION_FAILED' }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
