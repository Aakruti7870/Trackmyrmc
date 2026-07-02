import test from 'node:test';
import assert from 'node:assert/strict';
import { db, pool } from '../db/index.js';
import { uploadedFiles } from '../db/schema.js';
import { registerUploadedFile, unregisterUploadedFilesSafe } from '../lib/uploadedFiles.js';

test('unregisterUploadedFilesSafe removes exactly the given vault rows', async (t) => {
  t.after(async () => { await pool.end(); });

  await db.delete(uploadedFiles);
  await registerUploadedFile({ storagePath: '/objects/uploads/keep-me', fileType: 'proof_photo' });
  await registerUploadedFile({ storagePath: '/objects/uploads/drop-a', fileType: 'proof_photo' });
  await registerUploadedFile({ storagePath: '/objects/uploads/drop-b', fileType: 'fuel_bill' });

  await unregisterUploadedFilesSafe(['/objects/uploads/drop-a', '/objects/uploads/drop-b']);

  const remaining = await db.select().from(uploadedFiles);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].storagePath, '/objects/uploads/keep-me');

  await unregisterUploadedFilesSafe([]);
  assert.equal((await db.select().from(uploadedFiles)).length, 1);
});
