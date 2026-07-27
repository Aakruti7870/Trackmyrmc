import test from 'node:test';
import assert from 'node:assert/strict';

const ACTIVE = new Set(['ACCEPTING_ORDERS', 'BUSY', 'LIMITED_CAPACITY']);
function canActivate(input: { onboardingStatus: string; publicationStatus: string; operationalStatus: string; isActive: boolean }): boolean {
  return input.onboardingStatus === 'APPROVED' && input.publicationStatus === 'PUBLISHED' && input.isActive && ACTIVE.has(input.operationalStatus);
}

test('approval as draft cannot satisfy activation/public visibility', () => {
  assert.equal(canActivate({ onboardingStatus: 'NOT_INVITED', publicationStatus: 'DRAFT', operationalStatus: 'UNCONFIRMED', isActive: false }), false);
});

test('only approved, published and order-capable plants satisfy activation', () => {
  assert.equal(canActivate({ onboardingStatus: 'APPROVED', publicationStatus: 'PUBLISHED', operationalStatus: 'ACCEPTING_ORDERS', isActive: true }), true);
  assert.equal(canActivate({ onboardingStatus: 'APPROVED', publicationStatus: 'PUBLISHED', operationalStatus: 'BUSY', isActive: true }), true);
  assert.equal(canActivate({ onboardingStatus: 'APPROVED', publicationStatus: 'PUBLISHED', operationalStatus: 'LIMITED_CAPACITY', isActive: true }), true);
  assert.equal(canActivate({ onboardingStatus: 'APPROVED', publicationStatus: 'PUBLISHED', operationalStatus: 'MAINTENANCE', isActive: true }), false);
});
