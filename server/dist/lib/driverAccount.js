import crypto from 'crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, drivers, vehicles, challans, auditLogs } from '../db/schema.js';
import { hashPassword } from './password.js';
// PG unique-violation code, read defensively: drizzle-orm 0.45 wraps the driver
// error, so `code`/`constraint` may live on `err.cause` rather than the top level.
function pgErrorCode(err) {
    if (!err || typeof err !== 'object')
        return undefined;
    const top = err.code;
    if (top)
        return top;
    const cause = err.cause;
    return cause?.code;
}
/**
 * Resolve a *verified* phone number to a DRIVER-role login, if one exists.
 *
 * Drivers are provisioned by plant staff into the `drivers` table (never
 * self-service), so — unlike the general staff/email path — it is safe to let a
 * verified number sign in as its linked driver. This is a deliberate, scoped
 * extension of the phone-identity boundary: it only ever resolves the lowest
 * privilege staff role ('driver'), matched against a staff-provisioned drivers
 * row, and never mints an admin/authority/dispatcher token.
 *
 * Admin-created drivers have a `users` row with role='driver' but `users.phone`
 * is NULL by design, so the customer resolver (which keys off users.phone) can
 * never find them — which is exactly why they used to fall through and get a new
 * customer account. We therefore match on the DRIVERS table (by last-10 digits,
 * since driver phones are stored raw/unnormalized) and keep the driver's
 * users.phone NULL to avoid colliding with the phone-unique index.
 *
 * The caller MUST have already verified ownership of `phone` (an OTP check).
 * `phone` must already be normalized to E.164.
 */
export async function resolveDriverByPhone(phone) {
    const last10 = phone.replace(/\D/g, '').slice(-10);
    // Too short to be a real mobile number — let the customer path handle it.
    if (last10.length !== 10)
        return { kind: 'none' };
    // Match an ACTIVE driver on the last 10 digits, normalizing the stored value
    // in SQL so it matches regardless of how it was typed (+91…, 0…, spaces).
    const [driver] = await db
        .select()
        .from(drivers)
        .where(and(eq(drivers.isActive, true), sql `right(regexp_replace(${drivers.phone}, '[^0-9]', '', 'g'), 10) = ${last10}`))
        .orderBy(drivers.id)
        .limit(1);
    if (!driver)
        return { kind: 'none' };
    // A driver's plant/truck aren't on the drivers row. Prefer a fixed
    // vehicle→driver assignment (vehicles.driverId); fall back to the most recent
    // challan's plant so the plantId is still meaningful before a truck is pinned.
    const [truck] = await db
        .select({ id: vehicles.id, vehicleNo: vehicles.vehicleNo, plantId: vehicles.plantId })
        .from(vehicles)
        .where(eq(vehicles.driverId, driver.id))
        .orderBy(vehicles.id)
        .limit(1);
    let plantId = truck?.plantId ?? null;
    if (plantId == null) {
        const [latest] = await db
            .select({ plantId: challans.plantId })
            .from(challans)
            .where(eq(challans.driverId, driver.id))
            .orderBy(desc(challans.dispatchTime))
            .limit(1);
        plantId = latest?.plantId ?? null;
    }
    const truckId = truck?.id ?? null;
    const truckNo = truck?.vehicleNo ?? null;
    let [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.linkedDriverId, driver.id), isNull(users.deletedAt)));
    if (user) {
        if (user.role !== 'driver') {
            return {
                kind: 'error',
                status: 403,
                error: 'This number is linked to a non-driver account. Please contact your plant admin.',
            };
        }
        if (!user.isActive) {
            return {
                kind: 'error',
                status: 403,
                error: 'This driver account has been disabled. Please contact your plant admin.',
            };
        }
        // Backfill a derived plant if the account never had one set.
        if (plantId != null && user.plantId == null) {
            const [updated] = await db
                .update(users)
                .set({ plantId })
                .where(eq(users.id, user.id))
                .returning();
            if (updated)
                user = updated;
        }
        return {
            kind: 'match',
            user,
            driverId: driver.id,
            plantId: user.plantId ?? plantId,
            truckId,
            truckNo,
        };
    }
    // First sign-in for this driver: create the linked login. A distinct
    // placeholder email (keyed by driver id, not phone) avoids colliding with any
    // customer placeholder for the same number. The users.phone stays NULL so it
    // never collides with the live-phone unique index.
    const passwordHash = await hashPassword(crypto.randomBytes(32).toString('hex'));
    const email = `driver_${driver.id}@otp.local`;
    try {
        const created = await db.transaction(async (tx) => {
            const [u] = await tx
                .insert(users)
                .values({
                name: driver.name,
                email,
                passwordHash,
                role: 'driver',
                isActive: true,
                plantId,
                linkedDriverId: driver.id,
            })
                .returning();
            await tx.insert(auditLogs).values({
                actorId: null,
                actorName: driver.name,
                action: 'account_registered',
                targetUserId: u.id,
                targetUserEmail: u.email,
                status: 'success',
                detail: `Phone-verified driver login (driver #${driver.id})`,
            });
            return u;
        });
        return { kind: 'match', user: created, driverId: driver.id, plantId, truckId, truckNo };
    }
    catch (err) {
        // Two verifies for the same driver raced (or a stale link), or the derived
        // email was taken. Re-read the live linked account and continue.
        if (pgErrorCode(err) === '23505') {
            [user] = await db
                .select()
                .from(users)
                .where(and(eq(users.linkedDriverId, driver.id), isNull(users.deletedAt)));
            if (user && user.role === 'driver' && user.isActive) {
                return {
                    kind: 'match',
                    user,
                    driverId: driver.id,
                    plantId: user.plantId ?? plantId,
                    truckId,
                    truckNo,
                };
            }
            return {
                kind: 'error',
                status: 409,
                error: 'This driver login could not be created. Please contact your plant admin.',
            };
        }
        throw err;
    }
}
