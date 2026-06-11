import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';

import { db, pool } from '../db/index.js';
import { clients, challans, challanProofPhotos } from '../db/schema.js';
import { proofPhotoStore } from '../lib/proofPhoto.js';
import { migrateProofPhotos, writeFailureReport } from '../db/migrate-proof-photos.js';

// A minimal but valid 1x1 transparent PNG as an image data URL.
const BASE64_PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
// A second, distinct base64 data URL.
const BASE64_PHOTO_2 = BASE64_PHOTO.replace('iVBOR', 'iVBOX');

let challanSeq = 0;
async function createChallanWithClient() {
  const [client] = await db.insert(clients).values({
    name: 'Acme Co', contactPerson: 'Jane', phone: '1112223333',
  }).returning();
  challanSeq += 1;
  const [challan] = await db.insert(challans).values({
    challanNo: `CH-M${String(challanSeq).padStart(4, '0')}`,
    clientId: client.id,
    grade: 'M25',
    quantity: '6.00',
    status: 'delivered',
    dispatchTime: new Date(),
  }).returning();
  return challan;
}

async function addPhoto(challanId: number, photo: string) {
  const [row] = await db.insert(challanProofPhotos)
    .values({ challanId, photo }).returning();
  return row;
}

async function photoById(id: number): Promise<string> {
  const [row] = await db.select({ photo: challanProofPhotos.photo })
    .from(challanProofPhotos).where(eq(challanProofPhotos.id, id));
  return row.photo;
}

before(() => {
  // db/index.ts is imported above purely to get the isolated test DB handle.
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE challan_proof_photos, challans, clients RESTART IDENTITY CASCADE`,
  );
});

after(async () => {
  await pool.end();
});

test('migration uploads base64 photos to object storage and rewrites rows to entity paths', async (t) => {
  const challan = await createChallanWithClient();
  const base64A = await addPhoto(challan.id, BASE64_PHOTO);
  const base64B = await addPhoto(challan.id, BASE64_PHOTO_2);

  // Stub object storage: store() records each uploaded data URL and returns a
  // distinct entity path, so the test never touches the storage sidecar.
  const uploaded: string[] = [];
  let counter = 0;
  const storeMock = t.mock.method(proofPhotoStore, 'store', async (dataUrl: string) => {
    uploaded.push(dataUrl);
    return `/objects/uploads/migrated-${counter++}`;
  });

  const result = await migrateProofPhotos(db);

  assert.deepEqual(result, { migrated: 2, skipped: 0, failed: 0, failures: [] });
  assert.equal(storeMock.mock.callCount(), 2, 'each base64 photo is uploaded once');
  assert.deepEqual(uploaded, [BASE64_PHOTO, BASE64_PHOTO_2], 'original data URLs are uploaded');

  assert.equal(await photoById(base64A.id), '/objects/uploads/migrated-0', 'first row now holds an entity path');
  assert.equal(await photoById(base64B.id), '/objects/uploads/migrated-1', 'second row now holds an entity path');
});

test('already-migrated /objects/ rows are left untouched and not re-uploaded', async (t) => {
  const challan = await createChallanWithClient();
  const ENTITY_PATH = '/objects/uploads/already-there';
  const objectRow = await addPhoto(challan.id, ENTITY_PATH);
  const base64Row = await addPhoto(challan.id, BASE64_PHOTO);

  const storeMock = t.mock.method(proofPhotoStore, 'store', async () => '/objects/uploads/migrated-x');

  const result = await migrateProofPhotos(db);

  assert.deepEqual(result, { migrated: 1, skipped: 0, failed: 0, failures: [] },
    'only the base64 row is migrated; the object-path row is never selected');
  assert.equal(storeMock.mock.callCount(), 1, 'the already-migrated photo is not re-uploaded');
  assert.equal(await photoById(objectRow.id), ENTITY_PATH, 'the existing entity path is unchanged');
  assert.equal(await photoById(base64Row.id), '/objects/uploads/migrated-x', 'the base64 row is rewritten');
});

test('migration is idempotent: a second run is a no-op and no row holds base64 afterward', async (t) => {
  const challan = await createChallanWithClient();
  await addPhoto(challan.id, BASE64_PHOTO);
  await addPhoto(challan.id, BASE64_PHOTO_2);
  await addPhoto(challan.id, '/objects/uploads/pre-existing');

  let counter = 0;
  const storeMock = t.mock.method(proofPhotoStore, 'store', async () => `/objects/uploads/run-${counter++}`);

  const first = await migrateProofPhotos(db);
  assert.deepEqual(first, { migrated: 2, skipped: 0, failed: 0, failures: [] }, 'first run migrates the two base64 rows');

  const second = await migrateProofPhotos(db);
  assert.deepEqual(second, { migrated: 0, skipped: 0, failed: 0, failures: [] }, 'second run migrates nothing');
  assert.equal(storeMock.mock.callCount(), 2, 'no extra uploads happen on the second run');

  // After migrating, no row anywhere holds a base64 data URL payload.
  const remaining = await db.select({ photo: challanProofPhotos.photo }).from(challanProofPhotos);
  for (const r of remaining) {
    assert.ok(!r.photo.startsWith('data:image/'), `no base64 payload remains, found: ${r.photo.slice(0, 20)}`);
  }
});

test('migration with no base64 rows reports nothing to migrate', async (t) => {
  const challan = await createChallanWithClient();
  await addPhoto(challan.id, '/objects/uploads/a');
  await addPhoto(challan.id, '/objects/uploads/b');

  const storeMock = t.mock.method(proofPhotoStore, 'store', async () => '/objects/uploads/should-not-happen');

  const result = await migrateProofPhotos(db);

  assert.deepEqual(result, { migrated: 0, skipped: 0, failed: 0, failures: [] });
  assert.equal(storeMock.mock.callCount(), 0, 'nothing is uploaded when there is no base64 data');
});

test('partial failure: failed uploads are reported and the rows stay base64 in the database', async (t) => {
  const challan = await createChallanWithClient();
  const okRow = await addPhoto(challan.id, BASE64_PHOTO);
  const badRow = await addPhoto(challan.id, BASE64_PHOTO_2);

  // The first upload succeeds; the second throws, simulating a storage outage
  // mid-run so some photos remain stuck as base64.
  let call = 0;
  const storeMock = t.mock.method(proofPhotoStore, 'store', async () => {
    call += 1;
    if (call === 1) return '/objects/uploads/migrated-ok';
    throw new Error('object storage unavailable');
  });

  const result = await migrateProofPhotos(db);

  assert.equal(storeMock.mock.callCount(), 2, 'both base64 rows are attempted');
  assert.equal(result.migrated, 1, 'the successful upload is counted');
  assert.equal(result.failed, 1, 'the failed upload is counted');
  assert.deepEqual(result.failures, [
    { id: badRow.id, challanId: challan.id, error: 'object storage unavailable' },
  ], 'the failing row is reported with its id, challan, and error');

  // The good row is rewritten; the failed row is left as-is so it can be retried.
  assert.equal(await photoById(okRow.id), '/objects/uploads/migrated-ok', 'the successful row is migrated');
  assert.equal(await photoById(badRow.id), BASE64_PHOTO_2, 'the failed row still holds base64 in the database');

  // The failure summary is written durably to a report file.
  const dir = await mkdtemp(path.join(os.tmpdir(), 'proof-photo-report-'));
  const reportPath = await writeFailureReport(result, dir);
  assert.ok(reportPath, 'a report path is returned when there are failures');
  assert.ok(reportPath!.startsWith(dir), 'the report is written into the given directory');

  const written = JSON.parse(await readFile(reportPath!, 'utf8'));
  assert.equal(written.failed, 1);
  assert.deepEqual(written.failures, [
    { id: badRow.id, challanId: challan.id, error: 'object storage unavailable' },
  ], 'the report records which photo rows remain stuck');
  assert.equal(typeof written.generatedAt, 'string', 'the report is timestamped');
});

test('writeFailureReport writes nothing when there are no failures', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'proof-photo-report-'));
  const reportPath = await writeFailureReport(
    { migrated: 3, skipped: 1, failed: 0, failures: [] },
    dir,
  );
  assert.equal(reportPath, null, 'no report path is returned on a clean run');
  assert.deepEqual(await readdir(dir), [], 'no report file is created when nothing failed');
});
