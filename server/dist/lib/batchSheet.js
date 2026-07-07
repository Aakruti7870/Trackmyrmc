// Pure batch-sheet math for the Batch Report Generator. Standard batching
// formulas only (no vendor code): a production quantity is split into mixer
// batches, each batch's target weight per material is the mix design's per-cum
// weight × the batch size, and simulated/entered actuals stay inside the
// material-wise tolerance band.
export const MAX_BATCH_ROWS = 300;
const round = (v, dp) => {
    const f = 10 ** dp;
    return Math.round(v * f) / f;
};
// Weigh-scale style rounding: tiny loads (admixture) keep 2 decimals, everything
// else 1 decimal.
export const roundWeight = (v) => round(v, v < 10 ? 2 : 1);
// Splits a production quantity into batch sizes. Full batches of `batchSize`
// plus one partial final batch for any remainder (e.g. 6.5 cum on a 1.0 cum
// plant = 6 × 1.0 + 1 × 0.5).
export function computeBatchSizes(productionQty, batchSize) {
    if (!Number.isFinite(productionQty) || productionQty <= 0) {
        throw new Error('Production quantity must be a positive number');
    }
    if (!Number.isFinite(batchSize) || batchSize <= 0) {
        throw new Error('Batch size must be a positive number');
    }
    const full = Math.floor(productionQty / batchSize + 1e-9);
    const remainder = round(productionQty - full * batchSize, 4);
    const rows = full + (remainder > 0.0001 ? 1 : 0);
    if (rows > MAX_BATCH_ROWS) {
        throw new Error(`Too many batches (${rows}) — max ${MAX_BATCH_ROWS}. Increase batch size or reduce quantity.`);
    }
    if (rows === 0)
        throw new Error('Quantity too small for one batch');
    const sizes = Array.from({ length: full }, () => batchSize);
    if (remainder > 0.0001)
        sizes.push(remainder);
    return sizes;
}
export const targetFor = (m, size) => roundWeight(m.perCumKg * size);
// Generates realistic per-batch actuals inside the material tolerance band.
export function generateActuals(materials, size, rng = Math.random) {
    const actuals = {};
    for (const m of materials) {
        const target = m.perCumKg * size;
        const tol = Math.max(0, m.tolerancePct) / 100;
        const jitter = (rng() * 2 - 1) * tol;
        actuals[m.key] = roundWeight(target * (1 + jitter));
    }
    return actuals;
}
// Column + grand totals: Total Set Weight, Total Actual Weight, Difference %
// per material and Total Mass Difference % across the whole sheet.
export function computeTotals(materials, batches) {
    let totalSetMass = 0;
    let totalActualMass = 0;
    const perMaterial = materials.map((m) => {
        let totalSet = 0;
        let totalActual = 0;
        for (const b of batches) {
            totalSet += targetFor(m, b.size);
            totalActual += b.actuals[m.key] ?? 0;
        }
        totalSet = round(totalSet, 2);
        totalActual = round(totalActual, 2);
        totalSetMass += totalSet;
        totalActualMass += totalActual;
        const diffPct = totalSet > 0 ? round(((totalActual - totalSet) / totalSet) * 100, 2) : 0;
        return { key: m.key, label: m.label, totalSet, totalActual, diffPct };
    });
    totalSetMass = round(totalSetMass, 2);
    totalActualMass = round(totalActualMass, 2);
    const totalMassDiffPct = totalSetMass > 0
        ? round(((totalActualMass - totalSetMass) / totalSetMass) * 100, 2)
        : 0;
    return { perMaterial, totalSetMass, totalActualMass, totalMassDiffPct };
}
// Validates a client-posted materials array into a clean RecipeMaterial list.
export function parseMaterials(input) {
    if (!Array.isArray(input) || input.length === 0) {
        throw new Error('At least one material is required');
    }
    if (input.length > 20)
        throw new Error('Too many materials (max 20)');
    const seen = new Set();
    return input.map((raw, i) => {
        const r = raw;
        const label = typeof r.label === 'string' ? r.label.trim() : '';
        if (!label)
            throw new Error(`Material ${i + 1}: name is required`);
        const key = (typeof r.key === 'string' && r.key.trim())
            ? r.key.trim()
            : label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `m${i + 1}`;
        if (seen.has(key))
            throw new Error(`Material "${label}" is duplicated`);
        seen.add(key);
        const perCumKg = Number(r.perCumKg);
        if (!Number.isFinite(perCumKg) || perCumKg < 0 || perCumKg > 5000) {
            throw new Error(`Material "${label}": per-cum weight must be 0–5000 kg`);
        }
        const tolerancePct = Number(r.tolerancePct);
        if (!Number.isFinite(tolerancePct) || tolerancePct < 0 || tolerancePct > 10) {
            throw new Error(`Material "${label}": tolerance must be 0–10 %`);
        }
        return { key, label, perCumKg, tolerancePct };
    });
}
// Validates client-posted batch rows (edited actuals) against the snapshot.
export function parseBatches(input, materials) {
    if (!Array.isArray(input) || input.length === 0)
        throw new Error('At least one batch row is required');
    if (input.length > MAX_BATCH_ROWS)
        throw new Error(`Too many batch rows (max ${MAX_BATCH_ROWS})`);
    return input.map((raw, i) => {
        const r = raw;
        const size = Number(r.size);
        if (!Number.isFinite(size) || size <= 0 || size > 50) {
            throw new Error(`Batch ${i + 1}: invalid batch size`);
        }
        const src = (r.actuals && typeof r.actuals === 'object') ? r.actuals : {};
        const actuals = {};
        for (const m of materials) {
            const v = Number(src[m.key]);
            if (!Number.isFinite(v) || v < 0 || v > 100000) {
                throw new Error(`Batch ${i + 1}: invalid weight for ${m.label}`);
            }
            actuals[m.key] = roundWeight(v);
        }
        return { size, actuals };
    });
}
