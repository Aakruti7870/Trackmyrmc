import { and, eq, inArray, isNull, isNotNull, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { kycDocuments, kycProfiles, users, vehicles } from '../db/schema.js';
import { sendAutomationEmail } from './automationEmail.js';
import { emitSSEEvent } from './sseEmitter.js';

// How far ahead of a document's expiry we raise the alert.
const ALERT_WINDOW_DAYS = 30;
// Roles that receive KYC expiry alerts, per plant.
const ALERT_ROLES = ['authority', 'admin', 'plant_owner'] as const;
type AlertRole = typeof ALERT_ROLES[number];

// Scan for KYC documents entering the expiry window and alert reviewers once
// per document (once-only via kycDocuments.expiryAlertedAt — set in the same
// update that selects the row, so restarts and overlapping ticks can't
// double-send). Returns the number of documents alerted.
export async function tickKycExpiryAlerts(): Promise<number> {
  const cutoff = new Date(Date.now() + ALERT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Claim each due document by stamping expiryAlertedAt first; only rows we
  // actually claimed get an alert. UPDATE ... RETURNING is atomic per row.
  const claimed = await db
    .update(kycDocuments)
    .set({ expiryAlertedAt: new Date() })
    .where(and(
      isNull(kycDocuments.expiryAlertedAt),
      isNotNull(kycDocuments.expiryDate),
      lte(kycDocuments.expiryDate, cutoff),
    ))
    .returning({
      id: kycDocuments.id,
      profileId: kycDocuments.profileId,
      docType: kycDocuments.docType,
      expiryDate: kycDocuments.expiryDate,
    });
  if (claimed.length === 0) return 0;

  for (const doc of claimed) {
    try {
      const [profile] = await db
        .select({
          id: kycProfiles.id,
          plantId: kycProfiles.plantId,
          entityType: kycProfiles.entityType,
          subjectName: users.name,
          vehicleNo: vehicles.vehicleNo,
        })
        .from(kycProfiles)
        .leftJoin(users, eq(kycProfiles.userId, users.id))
        .leftJoin(vehicles, eq(kycProfiles.vehicleId, vehicles.id))
        .where(eq(kycProfiles.id, doc.profileId));
      if (!profile) continue;

      const subject = profile.vehicleNo
        ? `Vehicle ${profile.vehicleNo}`
        : (profile.subjectName ?? `KYC profile #${profile.id}`);
      const label = doc.docType.replace(/_/g, ' ').toUpperCase();

      emitSSEEvent(
        'kyc.expiring',
        { profileId: profile.id, docType: doc.docType, expiryDate: doc.expiryDate, subject },
        { roles: [...ALERT_ROLES], plantId: profile.plantId },
      );

      // Email the plant's reviewers (platform staff have plantId null and are
      // included when the profile itself is unscoped).
      const recipientFilter = profile.plantId == null
        ? and(inArray(users.role, [...ALERT_ROLES]), eq(users.isActive, true), isNull(users.deletedAt))
        : and(
            inArray(users.role, [...ALERT_ROLES]), eq(users.isActive, true), isNull(users.deletedAt),
            eq(users.plantId, profile.plantId),
          );
      const recipients = (await db.select({ email: users.email }).from(users).where(recipientFilter))
        .map((r) => r.email)
        .filter((e): e is string => !!e && !e.endsWith('@otp.local'));
      if (recipients.length > 0) {
        await sendAutomationEmail({
          to: recipients,
          subject: `KYC document expiring: ${label} — ${subject}`,
          heading: 'KYC document expiring soon',
          lines: [
            `${subject}'s ${label} document expires on ${doc.expiryDate}.`,
            'Please arrange for a renewed document to be uploaded and re-verified before it lapses.',
          ],
        });
      }
    } catch (e) {
      console.error(`KYC expiry alert failed for document #${doc.id}`, e);
    }
  }
  return claimed.length;
}
