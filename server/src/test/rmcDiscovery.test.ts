import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRmcSearchQueries,
  isLikelyDuplicate,
  nameSimilarity,
  normalizeIndianMobile,
  normalizeRmcName,
  scoreRmcCandidate,
} from '../lib/rmcDiscovery.js';
import { parsePlacesResponse, searchAllRmcPlaces } from '../lib/rmcPlacesClient.js';

test('query generator creates six locality searches and two industrial searches', () => {
  const normal = generateRmcSearchQueries({ locality: 'Panvel', marketName: 'Panvel' });
  assert.equal(normal.length, 6);
  assert.ok(normal.every(q => q.includes('Panvel')));
  assert.ok(normal.some(q => q === 'RMC plant in Panvel, Maharashtra'));

  const industrial = generateRmcSearchQueries({ locality: 'Taloja MIDC', marketName: 'Taloja MIDC', industrial: true });
  assert.equal(industrial.length, 8);
  assert.ok(industrial.includes('RMC plant near Taloja MIDC'));
  assert.ok(industrial.includes('concrete plant near Taloja MIDC'));
});

test('name normalization standardizes ready-mix variants and business suffixes', () => {
  assert.equal(normalizeRmcName('Aakruti Ready Mixed Concrete Pvt. Ltd.'), 'aakruti rmc');
  assert.equal(normalizeRmcName('AAKRUTI R.M.C. PRIVATE LIMITED'), 'aakruti rmc');
  assert.ok(nameSimilarity('Aakruti RMC Plant', 'Aakruti Ready Mix Concrete') >= 0.66);
});

test('confidence scoring applies positive and negative evidence', () => {
  const high = scoreRmcCandidate({
    name: 'ABC Ready Mix Concrete RMC Plant',
    address: 'Plot 9, Taloja MIDC Industrial Area',
    types: ['concrete_supplier'],
  });
  assert.equal(high.level, 'HIGH');
  assert.equal(high.discoveryStatus, 'NEEDS_REVIEW');
  assert.ok(high.score >= 70);
  assert.ok(high.reasons.some(r => r.rule.includes('RMC')));

  const irrelevant = scoreRmcCandidate({ name: 'ABC Cement Dealer and Hardware', address: 'Panvel' });
  assert.equal(irrelevant.discoveryStatus, 'REJECTED');
  assert.ok(irrelevant.score < 45);
});

test('duplicate detection requires proximity plus meaningful name similarity', () => {
  const a = { name: 'Concrete King RMC Plant', latitude: 18.9894, longitude: 73.1175, locality: 'Panvel' };
  const b = { name: 'Concrete King Ready Mix Concrete Pvt Ltd', latitude: 18.9898, longitude: 73.1178, locality: 'Panvel' };
  const c = { name: 'Unrelated Hardware Store', latitude: 18.9898, longitude: 73.1178, locality: 'Panvel' };
  assert.equal(isLikelyDuplicate(a, b, 200), true);
  assert.equal(isLikelyDuplicate(a, c, 200), false);
});

test('Indian mobile normalization keeps only a valid final ten digits', () => {
  assert.equal(normalizeIndianMobile('+91 98765 43210'), '9876543210');
  assert.equal(normalizeIndianMobile('123'), null);
});

test('Google response parser excludes missing identifiers and coordinates', () => {
  const parsed = parsePlacesResponse({
    places: [
      { id: 'p1', displayName: { text: 'ABC RMC' }, location: { latitude: 19, longitude: 73 }, businessStatus: 'OPERATIONAL' },
      { displayName: { text: 'Missing ID' }, location: { latitude: 19, longitude: 73 } },
      { id: 'p3', displayName: { text: 'Missing coordinate' } },
    ],
  });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].placeId, 'p1');
});

test('Places client follows nextPageToken without using the real API', async () => {
  process.env.GOOGLE_PLACES_API_KEY = 'test-key-not-real';
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { pageToken?: string };
    calls.push(body.pageToken ?? 'first');
    const payload = body.pageToken
      ? { places: [{ id: 'p2', displayName: { text: 'Second RMC' }, location: { latitude: 19.1, longitude: 73.1 } }] }
      : { places: [{ id: 'p1', displayName: { text: 'First RMC' }, location: { latitude: 19, longitude: 73 } }], nextPageToken: 'next' };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const result = await searchAllRmcPlaces({ textQuery: 'RMC plant in Panvel', latitude: 19, longitude: 73, radiusMeters: 50000, fetchImpl });
  assert.equal(result.pageCount, 2);
  assert.deepEqual(result.places.map(p => p.placeId), ['p1', 'p2']);
  assert.deepEqual(calls, ['first', 'next']);
});
