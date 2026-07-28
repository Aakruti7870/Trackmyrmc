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
  // Fallback is the privacy-masked form: last-4 digits of the client id.
  assert.equal(resolveCustomerName({ verifiedKycName: ' ', registrationName: '', clientId: 42 }), 'Customer \u2022\u2022\u2022\u2022 42');
});

test('fallback uses last-4 digits of a longer client id', () => {
  assert.equal(resolveCustomerName({ verifiedKycName: null, registrationName: null, clientId: 100042 }), 'Customer \u2022\u2022\u2022\u2022 0042');
});
