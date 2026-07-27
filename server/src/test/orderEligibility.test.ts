import assert from 'node:assert/strict';
import test from 'node:test';
import { isPlantOrderEligible } from '../lib/orderEligibility.js';

const eligible = { plantStatus: 'approved', isActive: true, locationVerified: true, verified: true, subscriptionStatus: 'active', networkStatus: 'active', showOnNetwork: true };

test('plant eligibility requires every backend publication gate', () => {
  assert.equal(isPlantOrderEligible(eligible), true);
  for (const patch of [
    { plantStatus: 'pending' }, { isActive: false }, { locationVerified: false }, { verified: false },
    { subscriptionStatus: 'suspended' }, { networkStatus: 'pending' }, { showOnNetwork: false },
  ]) assert.equal(isPlantOrderEligible({ ...eligible, ...patch }), false);
});
