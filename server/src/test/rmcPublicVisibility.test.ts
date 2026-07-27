import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVE_OPERATIONAL_STATUSES } from '../lib/rmcDiscovery.js';

function customerVisible(plant: {
  onboardingStatus: string;
  publicationStatus: string;
  isActive: boolean;
  operationalStatus: string;
}): boolean {
  return plant.onboardingStatus === 'APPROVED' &&
    plant.publicationStatus === 'PUBLISHED' &&
    plant.isActive &&
    (ACTIVE_OPERATIONAL_STATUSES as readonly string[]).includes(plant.operationalStatus);
}

test('customer visibility requires every publication condition', () => {
  const base = { onboardingStatus: 'APPROVED', publicationStatus: 'PUBLISHED', isActive: true, operationalStatus: 'ACCEPTING_ORDERS' };
  assert.equal(customerVisible(base), true);
  assert.equal(customerVisible({ ...base, onboardingStatus: 'INVITED' }), false);
  assert.equal(customerVisible({ ...base, publicationStatus: 'DRAFT' }), false);
  assert.equal(customerVisible({ ...base, isActive: false }), false);
  assert.equal(customerVisible({ ...base, operationalStatus: 'UNCONFIRMED' }), false);
  assert.equal(customerVisible({ ...base, operationalStatus: 'MAINTENANCE' }), false);
  assert.equal(customerVisible({ ...base, operationalStatus: 'BUSY' }), true);
  assert.equal(customerVisible({ ...base, operationalStatus: 'LIMITED_CAPACITY' }), true);
});
