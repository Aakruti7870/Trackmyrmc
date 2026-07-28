import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCustomerName } from '../lib/customerIdentity.js';

test('verified KYC legal name has authority over registration name', () => {
  assert.equal(resolveCustomerName({ verifiedKycName: '  Asha Patil ', registrationName: 'Asha Construction', clientId: 42 }), 'Asha Patil');
});

test('registration name remains visible before KYC', () => {
  assert.equal(resolveCustomerName({ verifiedKycName: null, registrationName: 'Asha Construction', clientId: 42 }), 'Asha Construction');
});

test('fallback is only used when both names are absent', () => {
  assert.equal(resolveCustomerName({ verifiedKycName: ' ', registrationName: '', clientId: 42 }), 'Customer 42');
});
