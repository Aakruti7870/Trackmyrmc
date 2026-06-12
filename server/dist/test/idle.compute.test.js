import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTripTiming, DEFAULT_IDLE_FREE_MIN } from '../lib/idle.js';
const base = '2026-06-01T08:00:00Z';
function at(minutes) {
    return new Date(new Date(base).getTime() + minutes * 60000).toISOString();
}
test('travel time is arrival minus dispatch in minutes', () => {
    const t = computeTripTiming({
        dispatchTime: at(0),
        siteArrivalTime: at(35),
        siteReleaseTime: null,
        config: { freeMin: DEFAULT_IDLE_FREE_MIN, ratePerHour: null },
    });
    assert.equal(t.travelMin, 35);
    assert.equal(t.siteMin, null, 'site time needs a release timestamp');
    assert.equal(t.billableIdleMin, null);
    assert.equal(t.idleCharge, null);
});
test('time at site within the free window has zero billable idle', () => {
    const t = computeTripTiming({
        dispatchTime: at(0),
        siteArrivalTime: at(30),
        siteReleaseTime: at(30 + 40), // 40 min at site, free window 45
        config: { freeMin: 45, ratePerHour: 600 },
    });
    assert.equal(t.siteMin, 40);
    assert.equal(t.billableIdleMin, 0, 'under the free window means no billable idle');
    assert.equal(t.idleCharge, 0, 'no billable idle means no charge');
});
test('billable idle is time at site beyond the free window', () => {
    const t = computeTripTiming({
        dispatchTime: at(0),
        siteArrivalTime: at(30),
        siteReleaseTime: at(30 + 105), // 105 min at site, free 45 -> 60 billable
        config: { freeMin: 45, ratePerHour: null },
    });
    assert.equal(t.siteMin, 105);
    assert.equal(t.billableIdleMin, 60);
    assert.equal(t.idleCharge, null, 'no rate configured means no money figure');
});
test('idle charge applies the per-hour rate to billable idle', () => {
    const t = computeTripTiming({
        dispatchTime: at(0),
        siteArrivalTime: at(30),
        siteReleaseTime: at(30 + 105), // 60 billable minutes = 1 hour
        config: { freeMin: 45, ratePerHour: 600 },
    });
    assert.equal(t.billableIdleMin, 60);
    assert.equal(t.idleCharge, 600, '1 billable hour at ₹600/hr');
});
test('idle charge prorates partial billable hours', () => {
    const t = computeTripTiming({
        dispatchTime: at(0),
        siteArrivalTime: at(30),
        siteReleaseTime: at(30 + 75), // 75 min at site, free 45 -> 30 billable = 0.5h
        config: { freeMin: 45, ratePerHour: 600 },
    });
    assert.equal(t.billableIdleMin, 30);
    assert.equal(t.idleCharge, 300, 'half an hour at ₹600/hr');
});
test('out-of-order timestamps collapse to null rather than negative figures', () => {
    const t = computeTripTiming({
        dispatchTime: at(60),
        siteArrivalTime: at(30), // arrival before dispatch
        siteReleaseTime: at(20), // release before arrival
        config: { freeMin: 45, ratePerHour: 600 },
    });
    assert.equal(t.travelMin, null, 'negative travel is dropped');
    assert.equal(t.siteMin, null, 'negative site time is dropped');
    assert.equal(t.billableIdleMin, null);
    assert.equal(t.idleCharge, null);
});
test('missing timestamps yield null timing without throwing', () => {
    const t = computeTripTiming({
        dispatchTime: null,
        siteArrivalTime: null,
        siteReleaseTime: null,
        config: { freeMin: 45, ratePerHour: 600 },
    });
    assert.deepEqual(t, { travelMin: null, siteMin: null, billableIdleMin: null, idleCharge: null });
});
