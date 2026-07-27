import { Router } from 'express';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { plants } from '../db/schema.js';
import { plantProfiles, plantPromotions } from '../db/plantProfileSchema.js';
import { requireAuth } from '../middleware/auth.js';
import { getGstPanVerifiedPlantIds } from '../lib/kycBadge.js';

const router = Router();
export const PAID_AD_RADIUS_KM = 15;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radius = 6371;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isOpenNow(openTime: string | null, closeTime: string | null): boolean {
  if (!openTime || !closeTime) return false;
  const now = new Date(Date.now() + 5.5 * 3600000);
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const toMin = (value: string) => { const [hours, minutes] = value.split(':').map(Number); return hours * 60 + (minutes || 0); };
  const open = toMin(openTime);
  const close = toMin(closeTime);
  return close <= open ? mins >= open || mins < close : mins >= open && mins < close;
}

router.get('/nearby', requireAuth, async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const requestedRadius = req.query.radius ?? req.query.radiusKm;
  const radius = requestedRadius == null ? 40 : Number(requestedRadius);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Valid lat (-90 to 90) and lng (-180 to 180) are required' });
  }
  const searchRadius = Math.min(Number.isFinite(radius) && radius > 0 ? radius : 40, 250);

  try {
    // Preserve the existing customer visibility contract: approved, active,
    // location-verified and authority-verified partner plants are eligible.
    // Older valid plants may not yet have the newer network flags populated.
    const visiblePlants = await db.select().from(plants).where(and(
      eq(plants.plantStatus, 'approved'),
      eq(plants.isActive, true),
      eq(plants.locationVerified, true),
      eq(plants.verified, true),
    ));
    const ids = visiblePlants.map(plant => plant.id);
    const now = new Date();
    const [profiles, paidAds, gstPanVerified] = await Promise.all([
      ids.length ? db.select().from(plantProfiles).where(and(inArray(plantProfiles.plantId, ids), eq(plantProfiles.profileStatus, 'verified'))) : [],
      ids.length ? db.select().from(plantPromotions).where(and(
        inArray(plantPromotions.plantId, ids),
        eq(plantPromotions.isActive, true),
        inArray(plantPromotions.paymentStatus, ['paid', 'waived']),
      )) : [],
      getGstPanVerifiedPlantIds(),
    ]);

    const profileByPlant = new Map(profiles.map(profile => [profile.plantId, profile]));
    const paidAdByPlant = new Map(paidAds.filter(paidAd => paidAd.startAt <= now && paidAd.endAt >= now).map(paidAd => [paidAd.plantId, paidAd]));
    const out = visiblePlants.map(plant => {
      const plantLat = Number(plant.latitude);
      const plantLng = Number(plant.longitude);
      if (!Number.isFinite(plantLat) || !Number.isFinite(plantLng) || plantLat < -90 || plantLat > 90 || plantLng < -180 || plantLng > 180) return null;
      const distanceKm = Math.round(haversineKm(lat, lng, plantLat, plantLng) * 10) / 10;
      if (distanceKm > searchRadius) return null;

      const profile = profileByPlant.get(plant.id);
      const paidAd = paidAdByPlant.get(plant.id);
      const paidAdActiveForCustomer = Boolean(paidAd && distanceKm <= PAID_AD_RADIUS_KM);
      return {
        id: plant.id,
        name: plant.name,
        address: plant.address,
        city: plant.city,
        contactNumber: plant.contactNumber,
        latitude: plantLat,
        longitude: plantLng,
        deliveryRadiusKm: plant.deliveryRadiusKm,
        grades: plant.grades,
        openTime: plant.openTime,
        closeTime: plant.closeTime,
        openNow: isOpenNow(plant.openTime, plant.closeTime),
        gstPanVerified: gstPanVerified.has(plant.id),
        distanceKm,
        capabilities: profile ? {
          numberOfTransitMixers: profile.numberOfTransitMixers,
          productionCapacityM3PerHour: profile.productionCapacityM3PerHour,
          laboratoryAvailable: profile.laboratoryAvailable,
          inhouseConcretePumpAvailable: profile.inhouseConcretePumpAvailable,
          supportingPlantAvailable: profile.supportingPlantAvailable,
          dieselGeneratorAvailable: profile.dieselGeneratorAvailable,
        } : null,
        showGlowingEffect: Boolean(paidAdActiveForCustomer && paidAd?.showGlowingEffect),
        _paidAdActive: paidAdActiveForCustomer,
        _priority: paidAdActiveForCustomer ? paidAd!.priorityRank : Number.MAX_SAFE_INTEGER,
        _updated: paidAdActiveForCustomer ? paidAd!.updatedAt.getTime() : 0,
      };
    }).filter(Boolean) as Array<Record<string, any>>;

    out.sort((a, b) => {
      if (a._paidAdActive !== b._paidAdActive) return a._paidAdActive ? -1 : 1;
      if (a._paidAdActive) return a._priority - b._priority || b._updated - a._updated || a.distanceKm - b.distanceKm || a.name.localeCompare(b.name);
      return a.distanceKm - b.distanceKm || a.name.localeCompare(b.name);
    });

    return res.status(200).json({
      plants: out.map(({ _paidAdActive, _priority, _updated, ...plant }) => plant),
      count: out.length,
    });
  } catch (error) {
    console.error('[plants] paid ad nearby lookup failed:', error);
    return res.status(500).json({ error: 'Could not load nearby plants.' });
  }
});

export default router;
