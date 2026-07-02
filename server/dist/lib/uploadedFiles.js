import { and, count, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { uploadedFiles } from '../db/schema.js';
// Mirror a freshly-uploaded storage path into the unified vault. This is an
// additive catalogue entry — it must never break the primary upload, so callers
// invoke it best-effort (failures are swallowed by registerUploadedFileSafe).
// Idempotent on storagePath: re-registering the same object is a no-op.
export async function registerUploadedFile(input) {
    const [row] = await db.insert(uploadedFiles).values({
        storagePath: input.storagePath,
        fileType: input.fileType,
        plantId: input.plantId ?? null,
        userId: input.userId ?? null,
        orderId: input.orderId ?? null,
        challanId: input.challanId ?? null,
        fileName: input.fileName ?? null,
        accessLevel: input.accessLevel ?? 'plant',
    }).onConflictDoNothing({ target: uploadedFiles.storagePath }).returning();
    return row ?? null;
}
// Best-effort variant for hot upload paths: a vault bookkeeping failure must not
// fail the user's proof-photo or fuel-bill save.
export async function registerUploadedFileSafe(input) {
    try {
        await registerUploadedFile(input);
    }
    catch (err) {
        console.error('[vault] failed to register uploaded file', input.storagePath, err);
    }
}
export async function registerUploadedFilesSafe(inputs) {
    await Promise.allSettled(inputs.map(registerUploadedFileSafe));
}
// Remove vault rows for storage paths that were deleted/orphaned. Best-effort.
export async function unregisterUploadedFilesSafe(storagePaths) {
    if (!storagePaths.length)
        return;
    try {
        await db.delete(uploadedFiles).where(inArray(uploadedFiles.storagePath, storagePaths));
    }
    catch (err) {
        console.error('[vault] failed to unregister uploaded files', err);
    }
}
// Platform-wide storage usage aggregate (super-admin only). Grouped by plant and
// file type; callers join plant names on the frontend.
export async function getStorageUsage() {
    const rows = await db
        .select({
        plantId: uploadedFiles.plantId,
        fileType: uploadedFiles.fileType,
        fileCount: count(uploadedFiles.id),
    })
        .from(uploadedFiles)
        .groupBy(uploadedFiles.plantId, uploadedFiles.fileType);
    return rows.map(r => ({ plantId: r.plantId, fileType: r.fileType, fileCount: Number(r.fileCount) }));
}
// List files for a single plant (plant-scoped vault view). Optionally filter by
// type. Returns newest first.
export async function listPlantFiles(plantId, fileType) {
    const conds = [eq(uploadedFiles.plantId, plantId)];
    if (fileType)
        conds.push(eq(uploadedFiles.fileType, fileType));
    return db
        .select()
        .from(uploadedFiles)
        .where(conds.length > 1 ? and(...conds) : conds[0])
        .orderBy(sql `${uploadedFiles.uploadedAt} DESC`);
}
