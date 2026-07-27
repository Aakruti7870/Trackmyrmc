// Run an explicit list of node:test files one at a time in isolated processes.
//
// TrackMyRMC integration suites share a Postgres schema and many suites call
// pool.end() in their teardown. Passing multiple files directly to `node --test`
// can therefore make one suite close resources another suite still needs, or
// leave an SSE/timer handle keeping the combined process alive. This runner
// preserves the repository test contract: one file, one process, serial DB use,
// and a forced clean exit after each completed suite.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, '');
const files = process.argv.slice(2);

if (files.length === 0) {
  console.error('No focused test files were provided.');
  process.exit(1);
}

function runFile(file) {
  return new Promise((resolve) => {
    const child = spawn(
      'node',
      [
        '--import', 'tsx',
        '--experimental-test-module-mocks',
        '--test',
        '--test-concurrency=1',
        '--test-force-exit',
        '--test-reporter', 'spec',
        file,
      ],
      {
        cwd: serverDir,
        env: { ...process.env, NODE_ENV: 'test' },
        stdio: 'inherit',
      },
    );

    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', (error) => {
      console.error(`Failed to start ${file}:`, error);
      resolve(1);
    });
  });
}

for (const file of files) {
  console.log(`\n===== focused test: ${file} =====`);
  const code = await runFile(file);
  if (code !== 0) {
    console.error(`Focused test failed: ${file}`);
    process.exit(code);
  }
}

console.log(`\nAll ${files.length} focused test file(s) passed.`);
