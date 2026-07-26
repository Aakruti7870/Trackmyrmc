import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRmcSearchQueries,
  isLikelyDuplicate,
  nameSimilarity,
  normalizeGstin,
  normalizeIndianMobile,
  normalizeRmcName,
  scoreRmcCandidate,
} from '../lib/rmcDiscovery.js';
import { parsePlacesResponse } from '../lib/rmcPlacesClient.js';

test('generates six locality searches and industrial variants', () => {
  const standard = generateRmcSearchQueries({ locality: 'Panvel', marketName: 'Panvel', industrial: false });
  assert.equal(standard.length, 6);
  assert.ok(standard.every(query => query.includes('Panvel')));
  const industrial = generateRmcSearchQueries({ locality: 'Taloja MIDC', marketName: 'Taloja MIDC', industrial: true });
  assert.equal(industrial.length, 8);
  assert.ok(industrial.includes('RMC plant near Taloja MIDC'));
});

test('normalizes RMC names and business suffixes', () => {
  assert.equal(normalizeRmcName('ABC Ready Mixed Concrete Pvt. Ltd.'), 'abc rmc');
  assert.equal(normalizeRmcName('A.B.C. R.M.C. LLP'), 'a b c rmc');
  assert.equal(normalizeGstin('27 abcde 1234 f1z5'), '27ABCDE1234F1Z5');
  assert.equal(normalizeIndianMobile('+91 98765-43210'), '9876543210');
});

test('scores strong RMC plants above review threshold', () => {
  const result = scoreRmcCandidate({
    name: 'Concrete King Ready Mix Concrete Plant',
    address: 'Taloja MIDC Industrial Area',
    types: ['concrete_supplier'],
  });
  assert.equal(result.level, 'HIGH');
  assert.equal(result.discoveryStatus, 'NEEDS_REVIEW');
  assert.ok(result.score >= 70);
  assert.ok(result.reasons.some(reason => reason.rule.includes('Ready Mix')));
});

test('rejects irrelevant equipment and hardware businesses', () => {
  const result = scoreRmcCandidate({ name: 'Concrete Equipment and Hardware Office', address: 'Pune' });
  assert.equal(result.discoveryStatus, 'REJECTED');
  assert.ok(result.score < 45);
});

test('detects nearby similarly named plants without auto-merging unrelated names', () => {
  const a = { name: 'ABC RMC Pvt Ltd', latitude: 19.05, longitude: 73.12, locality: 'Taloja' };
  const b = { name: 'ABC Ready Mix Concrete', latitude: 19.0505, longitude: 73.1205, locality: 'Taloja' };
  const c = { name: 'XYZ Hardware', latitude: 19.0505, longitude: 73.1205, locality: 'Taloja' };
  assert.ok(nameSimilarity(a.name, b.name) >= 0.45);
  assert.equal(isLikelyDuplicate(a, b, 200), true);
  assert.equal(isLikelyDuplicate(a, c, 200), false);
});

test('parses Places response and excludes missing identifiers or coordinates', () => {
  const rows = parsePlacesResponse({
    places: [
      { id: 'place-1', displayName: { text: 'ABC RMC' }, formattedAddress: 'Panvel', location: { latitude: 18.99, longitude: 73.11 }, businessStatus: 'OPERATIONAL', googleMapsUri: 'https://maps.example/1', types: ['concrete_supplier'] },
      { displayName: { text: 'Missing ID' }, location: { latitude: 18.9, longitude: 73.1 } },
      { id: 'missing-location', displayName: { text: 'Missing Location' } },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].placeId, 'place-1');
  assert.equal(rows[0].businessStatus, 'OPERATIONAL');
});
