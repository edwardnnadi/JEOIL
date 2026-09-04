import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const migrationDirectory = join(root, 'drizzle');
const migrationFiles = readdirSync(migrationDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort();

for (const file of migrationFiles) {
  const result = spawnSync(
    process.execPath,
    [
      join('node_modules', 'wrangler', 'bin', 'wrangler.js'),
      'd1',
      'execute',
      'DB',
      '--local',
      '--config',
      'wrangler.cloud.jsonc',
      '--file',
      join('drizzle', file),
    ],
    { cwd: root, stdio: 'inherit' },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
