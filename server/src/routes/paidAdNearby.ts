import { Router } from 'express';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { plants } from '../db/schema.js';
import { plantProfiles, plantPromotions } from '../db/plantProfileSchema.js';
import { requireAuth } from '../middleware/auth.js';
import { getGstPanVerifiedPlantIds } from '../lib/kycBadge.js';

const router = Router();
const PAID_AD_RADIUS_KM = 15;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isOpenNow(openTime: string | null, closeTime: string | null): boolean {
  if (!openTime || !closeTime) return false;
  const now = new Date(Date.now() + 5.5 * 3600000);
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
  const open = toMin(openTime); const close = toMin(closeTime);
  return close <= open ? mins >= open || mins < close : mins >= open && mins < close;
}

router.get('/nearby', requireAuth, async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = req.query.radius == null ? 40 : Number(req.query.radius);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Valid lat (-90 to 90) and lng (-180 to 180) are required' });
  }
  const searchRadius = Math.min(Number.isFinite(radius) && radius > 0 ? radius : 40, 250);
  try {
    const visiblePlants = await db.select().from(plants).where(and(
      eq(plants.plantStatus, 'approved'), eq(plants.isActive, true), eq(plants.locationVerified, true),
      eq(plants.verified, true), eq(plants.networkStatus, 'active'), eq(plants.showOnNetwork, true),
    ));
    const ids = visiblePlants.map(p => p.id);
    const [profiles, paidAds, gstPanVerified] = await Promise.all([
      ids.length ? db.select().from(plantProfiles).where(and(inArray(plantProfiles.plantId, ids), eq(plantProfiles.profileStatus, 'verified'))) : [],
      ids.length ? db.select().from(plantPromotions).where(and(inArray(plantPromotions.plantId, ids), eq(plantPromotions.isActive, true), eq(plantPromotions.paymentStatus, 'paid'))) : [],
      getGstPanVerifiedPlantIds(),
    ]);
    const profileByPlant = new Map(profiles.map(p => [p.plantId, p]));
    const paidAdByPlant = new Map(paidAds.filter(p => p.startAt <= new Date() && p.endAt >= new Date()).map(p => [p.plantId, p]));
    const out = visiblePlants.map(p => {
      const pLat = Number(p.latitude); const pLng = Number(p.longitude);
      if (!Number.isFinite(pLat) || !Number.isFinite(pLng) || pLat < -90 || pLat > 90 || pLng < -180 || pLng > 180) return null;
      const distanceKm = Math.round(haversineKm(lat, lng, pLat, pLng) * 10) / 10;
      if (distanceKm > searchRadius) return null;
      const profile = profileByPlant.get(p.id);
      const paidAd = paidAdByPlant.get(p.id);
      const paidAdActiveForCustomer = Boolean(paidAd && distanceKm <= PAID_AD_RADIUS_KM);
      return {
        id: p.id, name: p.name, address: p.address, city: p.city, contactNumber: p.contactNumber,
        latitude: pLat, longitude: pLng, deliveryRadiusKm: p.deliveryRadiusKm, grades: p.grades,
        openTime: p.openTime, closeTime: p.closeTime, openNow: isOpenNow(p.openTime, p.closeTime),
        gstPanVerified: gstPanVerified.has(p.id), distanceKm,
        capabilities: profile ? {
          numberOfTransitMixers: profile.numberOfTransitMixers,
          productionCapacityM3PerHour: profile.productionCapacityM3PerHour,
          laboratoryAvailable: profile.laboratoryAvailable,
          inhouseConcretePumpAvailable: profile.inhouseConcretePumpAvailable,
          supportingPlantAvailable: profile.supportingPlantAvailable,
          dieselGeneratorAvailable: profile.dieselGeneratorAvailable,
        } : null,
        showGlowingEffect: paidAdActiveForCustomer && paidAd!.showGlowingEffect,
        _paidAdActive: paidAdActiveForCustomer,
        _priority: paidAdActiveForCustomer ? paidAd!.priorityRank : Number.MAX_SAFE_INTEGER,
        _updated: paidAdActiveForCustomer ? paidAd!.updatedAt.getTime() : 0,
      };
    }).filter(Boolean) as any[];
    out.sort((a, b) => {
      if (a._paidAdActive !== b._paidAdActive) return a._paidAdActive ? -1 : 1;
      if (a._paidAdActive) return a._priority - b._priority || b._updated - a._updated || a.distanceKm - b.distanceKm || a.name.localeCompare(b.name);
      return a.distanceKm - b.distanceKm || a.name.localeCompare(b.name);
    });
    res.status(200).json({ plants: out.map(({ _paidAdActive, _priority, _updated, ...p }) => p), count: out.length });
  } catch (error) {
    console.error('[plants] paid ad nearby lookup failed:', error);
    res.status(500).json({ error: 'Could not load nearby plants.' });
  }
});

export default router;
