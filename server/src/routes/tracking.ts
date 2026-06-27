import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challans, sites, vehicles, plants } from '../db/schema.js';
import { resolveTrackingToken } from '../lib/trackingTokens.js';
import { getLivePosition } from './positions.js';
import { getFreshnessConfig, computeFreshness } from '../lib/freshness.js';

const router = Router();

// PUBLIC endpoint — deliberately NOT behind requireAuth. A share token resolves
// to a single challan and we return a minimal, no-PII tracking payload: what's
// being delivered, the destination site (name/city + coords) and the latest live
// truck fix. Client and driver identity/contact are intentionally omitted —
// anyone holding the link can view this.
router.get('/:token', async (req, res) => {
  const challanId = await resolveTrackingToken(req.params.token);
  if (challanId == null) {
    res.status(404).json({ error: 'This tracking link is invalid or has expired.' });
    return;
  }

  const [row] = await db
    .select({
      challanNo: challans.challanNo,
      status: challans.status,
      grade: challans.grade,
      quantity: challans.quantity,
      dispatchTime: challans.dispatchTime,
      deliveryTime: challans.deliveryTime,
      siteArrivalTime: challans.siteArrivalTime,
      vehicleNo: vehicles.vehicleNo,
      siteName: sites.name,
      siteCity: sites.city,
      siteLat: sites.latitude,
      siteLng: sites.longitude,
      plantName: plants.name,
      plantLat: plants.latitude,
      plantLng: plants.longitude,
    })
    .from(challans)
    .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
    .leftJoin(sites, eq(challans.siteId, sites.id))
    .leftJoin(plants, eq(challans.plantId, plants.id))
    .where(eq(challans.id, challanId));

  if (!row) {
    res.status(404).json({ error: 'Trip not found.' });
    return;
  }

  const pos = getLivePosition(challanId);

  // Pour-by countdown only while in transit; once delivered there's nothing left
  // to race against.
  let freshness = null;
  if (row.status === 'dispatched') {
    const config = await getFreshnessConfig();
    freshness = computeFreshness({
      dispatchTime: row.dispatchTime ? new Date(row.dispatchTime).toISOString() : null,
      config,
      distanceM: pos?.distanceM ?? null,
      speed: pos?.speed ?? null,
    });
  }

  res.json({
    challanNo: row.challanNo,
    status: row.status,
    grade: row.grade,
    quantity: row.quantity,
    vehicleNo: row.vehicleNo,
    plantName: row.plantName,
    plant:
      row.plantLat != null && row.plantLng != null
        ? { lat: Number(row.plantLat), lng: Number(row.plantLng) }
        : null,
    site: {
      name: row.siteName,
      city: row.siteCity,
      lat: row.siteLat != null ? Number(row.siteLat) : null,
      lng: row.siteLng != null ? Number(row.siteLng) : null,
    },
    dispatchTime: row.dispatchTime ? new Date(row.dispatchTime).toISOString() : null,
    deliveryTime: row.deliveryTime ? new Date(row.deliveryTime).toISOString() : null,
    siteArrivalTime: row.siteArrivalTime ? new Date(row.siteArrivalTime).toISOString() : null,
    live: pos
      ? {
          lat: pos.lat,
          lng: pos.lng,
          heading: pos.heading,
          speed: pos.speed,
          distanceM: pos.distanceM,
          updatedAt: pos.updatedAt,
        }
      : null,
    freshness,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
