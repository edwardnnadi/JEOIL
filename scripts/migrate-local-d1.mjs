import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const migrationDirectory = join(root, 'drizzle');
const migrationFiles = readdirSync(migrationDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort();

function runWrangler(args, options = {}) {
  return spawnSync(
    process.execPath,
    [
      join('node_modules', 'wrangler', 'bin', 'wrangler.js'),
      'd1',
      'execute',
      'DB',
      '--local',
      '--config',
      'wrangler.cloud.jsonc',
      ...args,
    ],
    { cwd: root, encoding: 'utf8', ...options },
  );
}

function queryCount(sql) {
  const result = runWrangler(['--command', sql]);
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return Number(result.stdout.match(/"count":\s*(\d+)/)?.[1] ?? 0);
}

function execute(sql) {
  const result = runWrangler(['--command', sql], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

execute(
  'CREATE TABLE IF NOT EXISTS __local_migrations (filename TEXT PRIMARY KEY NOT NULL, applied_at INTEGER NOT NULL);',
);

// Older local databases predate the migration ledger. Their operations schema
// is already present, so establish the baseline without replaying it.
if (
  queryCount('SELECT COUNT(*) AS count FROM __local_migrations;') === 0 &&
  queryCount("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'customers';") > 0
) {
  for (const file of migrationFiles) {
    execute(
      `INSERT OR IGNORE INTO __local_migrations (filename, applied_at) VALUES ('${file}', unixepoch());`,
    );
  }
}

for (const file of migrationFiles) {
  if (
    queryCount(
      `SELECT COUNT(*) AS count FROM __local_migrations WHERE filename = '${file}';`,
    ) > 0
  ) {
    continue;
  }

  const result = runWrangler(['--file', join('drizzle', file)], {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  execute(
    `INSERT INTO __local_migrations (filename, applied_at) VALUES ('${file}', unixepoch());`,
  );
}
