import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertKycTransition,
  canTransitionKyc,
  isKycState,
  kycOrderEligible,
  KYC_STATES,
  transitionRequiresReason,
} from '../lib/kycStateMachine.js';

test('KYC exposes every production lifecycle state', () => {
  assert.deepEqual(KYC_STATES, ['pending', 'submitted', 'under_review', 'verified', 'rejected', 'suspended', 'expired', 'revoked']);
  assert.equal(KYC_STATES.every(isKycState), true);
});

test('subjects submit but cannot approve themselves', () => {
  assert.equal(canTransitionKyc('pending', 'submitted', 'subject'), true);
  assert.equal(canTransitionKyc('submitted', 'under_review', 'subject'), false);
  assert.equal(canTransitionKyc('under_review', 'verified', 'subject'), false);
  assert.throws(() => assertKycTransition('under_review', 'verified', 'subject'), /not permitted/);
});

test('reviewers control review and administrative transitions', () => {
  assert.equal(canTransitionKyc('submitted', 'under_review', 'reviewer'), true);
  assert.equal(canTransitionKyc('under_review', 'verified', 'reviewer'), true);
  assert.equal(canTransitionKyc('verified', 'suspended', 'reviewer'), true);
  assert.equal(canTransitionKyc('suspended', 'verified', 'reviewer'), true);
  assert.equal(canTransitionKyc('verified', 'revoked', 'reviewer'), true);
});

test('only verified identities are eligible to place gated orders', () => {
  for (const state of KYC_STATES) assert.equal(kycOrderEligible(state), state === 'verified');
});

test('adverse and reactivation decisions require reasons', () => {
  assert.equal(transitionRequiresReason('under_review', 'rejected'), true);
  assert.equal(transitionRequiresReason('verified', 'suspended'), true);
  assert.equal(transitionRequiresReason('verified', 'revoked'), true);
  assert.equal(transitionRequiresReason('suspended', 'verified'), true);
  assert.equal(transitionRequiresReason('under_review', 'verified'), false);
});
