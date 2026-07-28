import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { kycProfiles, plants, users } from '../db/schema.js';

export interface PlantEligibilitySnapshot {
  plantStatus: string;
  isActive: boolean;
  locationVerified: boolean;
  verified: boolean;
  subscriptionStatus: string;
  networkStatus: string;
  showOnNetwork: boolean;
}

export function isPlantOrderEligible(plant: PlantEligibilitySnapshot): boolean {
  return plant.plantStatus === 'approved' && plant.isActive && plant.locationVerified && plant.verified
    && plant.subscriptionStatus !== 'suspended' && plant.subscriptionStatus !== 'cancelled'
    && plant.networkStatus === 'active' && plant.showOnNetwork;
}

export async function customerOrderEligibility(userId: number): Promise<{ eligible: boolean; reason?: string }> {
  const [user] = await db.select({ active: users.isActive, legacyStatus: users.kycStatus })
    .from(users).where(and(eq(users.id, userId), isNull(users.deletedAt)));
  if (!user?.active) return { eligible: false, reason: 'Your account is not active.' };
  if (user.legacyStatus === 'verified') return { eligible: true };
  const [profile] = await db.select({ status: kycProfiles.status }).from(kycProfiles).where(eq(kycProfiles.userId, userId));
  if (profile?.status === 'verified' || profile?.status === 'approved') return { eligible: true };
  return { eligible: false, reason: 'Verified KYC is required before placing an order.' };
}
