from pathlib import Path

backend = Path('server/src/routes/plants.ts')
text = backend.read_text(encoding='utf-8')
old = """router.get('/nearby', requireAuth, async (req, res) => {
  const lat = parseFloat(String(req.query.lat));
  const lng = parseFloat(String(req.query.lng));
  const radius = req.query.radius != null ? parseFloat(String(req.query.radius)) : 40;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: 'lat and lng are required' });
    return;
  }
  // Clamp to a sane ceiling: an unbounded radius would let a caller enumerate the
  // whole plant directory in one shot. 250km is the widest the UI offers.
  const MAX_RADIUS_KM = 250;
  const effRadius = Math.min(Number.isFinite(radius) && radius > 0 ? radius : 40, MAX_RADIUS_KM);

  const rows = await db.select().from(plants);
  // \"GST & PAN Verified\" trust badge: plants whose approved KYC profile carries
  // both registrations. Public-safe — it exposes a boolean, never the documents.
  const gstPanVerified = await getGstPanVerifiedPlantIds();
  const nearby = rows
    // Only plants the authority has marked active AND left visible on the network
    // are shown to customers. Onboarding leads / hidden plants never appear.
    .filter(customerVisible)
    .map(p => {
      const pLat = parseFloat(p.latitude);
      const pLng = parseFloat(p.longitude);
      return {
        id: p.id,
        name: p.name,
        address: p.address,
        city: p.city,
        contactNumber: p.contactNumber,
        latitude: pLat,
        longitude: pLng,
        deliveryRadiusKm: p.deliveryRadiusKm,
        grades: p.grades,
        openTime: p.openTime,
        closeTime: p.closeTime,
        openNow: isOpenNow(p.openTime, p.closeTime),
        gstPanVerified: gstPanVerified.has(p.id),
        distanceKm: Math.round(haversineKm(lat, lng, pLat, pLng) * 10) / 10,
      };
    })
    .filter(p => p.distanceKm <= effRadius)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  res.json(nearby);
});"""
new = """router.get('/nearby', requireAuth, async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = req.query.radius != null ? Number(req.query.radius) : 40;
  if (
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180
  ) {
    res.status(400).json({ error: 'Valid lat (-90 to 90) and lng (-180 to 180) are required' });
    return;
  }
  // Clamp to a sane ceiling: an unbounded radius would let a caller enumerate the
  // whole plant directory in one shot. 250km is the widest the UI offers.
  const MAX_RADIUS_KM = 250;
  const effRadius = Math.min(Number.isFinite(radius) && radius > 0 ? radius : 40, MAX_RADIUS_KM);

  try {
    const rows = await db.select().from(plants);
    // \"GST & PAN Verified\" trust badge: plants whose approved KYC profile carries
    // both registrations. Public-safe — it exposes a boolean, never the documents.
    const gstPanVerified = await getGstPanVerifiedPlantIds();
    const nearby = rows
      // Only authority-approved, active, verified, customer-visible partners
      // with valid coordinates may reach the customer response.
      .filter(customerVisible)
      .map(p => ({ p, pLat: Number(p.latitude), pLng: Number(p.longitude) }))
      .filter(({ pLat, pLng }) =>
        Number.isFinite(pLat) && Number.isFinite(pLng) &&
        pLat >= -90 && pLat <= 90 && pLng >= -180 && pLng <= 180,
      )
      .map(({ p, pLat, pLng }) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        city: p.city,
        contactNumber: p.contactNumber,
        latitude: pLat,
        longitude: pLng,
        deliveryRadiusKm: p.deliveryRadiusKm,
        grades: p.grades,
        openTime: p.openTime,
        closeTime: p.closeTime,
        openNow: isOpenNow(p.openTime, p.closeTime),
        gstPanVerified: gstPanVerified.has(p.id),
        distanceKm: Math.round(haversineKm(lat, lng, pLat, pLng) * 10) / 10,
      }))
      .filter(p => Number.isFinite(p.distanceKm) && p.distanceKm <= effRadius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.status(200).json({ plants: nearby, count: nearby.length });
  } catch (error) {
    console.error('[plants] nearby lookup failed:', error);
    res.status(500).json({ error: 'Could not load nearby plants.' });
  }
});"""
if old in text:
    backend.write_text(text.replace(old, new, 1), encoding='utf-8')
elif "res.status(200).json({ plants: nearby, count: nearby.length });" not in text:
    raise SystemExit('Backend route did not match expected source; refusing unsafe edit')

frontend = Path('rmc-app/src/pages/NearbyPlants.tsx')
text = frontend.read_text(encoding='utf-8')
marker = "interface SavedLocation { coords: LatLng; radius: number }\n"
helper = """interface SavedLocation { coords: LatLng; radius: number }

interface NearbyPlantsResponse {
  plants: NearbyPlant[];
  count: number;
}

function isValidCoords(value: LatLng): boolean {
  return Number.isFinite(value.lat) && Number.isFinite(value.lng) &&
    value.lat >= -90 && value.lat <= 90 && value.lng >= -180 && value.lng <= 180;
}
"""
if marker in text and 'interface NearbyPlantsResponse' not in text:
    text = text.replace(marker, helper, 1)
text = text.replace(
    "if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;",
    "if (!isValidCoords({ lat, lng })) return null;",
    1,
)
old_load = """  const loadPlants = useCallback(async (c: LatLng, radius: number) => {
    // Remember this confirmed location + radius so the next visit loads it
    // instantly. The coords are user-confirmed (GPS fix or manual pick) so we
    // persist even if the fetch below fails — that's a transient network issue,
    // not a bad location.
    saveLocation(c, radius);
    setPhase('loading');
    setFetchError('');
    setDiscovered([]);
    try {
      const data = await api.get<NearbyPlant[]>(`/plants/nearby?lat=${c.lat}&lng=${c.lng}&radius=${radius}`);
      setPlants(data);
      setPhase('ready');
    } catch (e) {
      setFetchError((e as Error).message || 'Could not load nearby plants.');
      setPhase('ready');
      setPlants([]);
    }
    loadDiscovered(c, radius);
  }, [loadDiscovered]);"""
new_load = """  const loadPlants = useCallback(async (c: LatLng, radius: number) => {
    if (!isValidCoords(c)) {
      setFetchError('Your location coordinates are invalid. Please choose the site location again.');
      setPlants([]);
      setDiscovered([]);
      setPhase('geoerror');
      return;
    }

    // Remember only validated coordinates. This prevents undefined, null, NaN,
    // empty or out-of-range values from ever reaching the API query string.
    saveLocation(c, radius);
    setPhase('loading');
    setFetchError('');
    setDiscovered([]);
    const query = new URLSearchParams({
      lat: String(c.lat),
      lng: String(c.lng),
      radius: String(radius),
    });
    try {
      const data = await api.get<NearbyPlantsResponse | NearbyPlant[]>(`/plants/nearby?${query.toString()}`);
      // Accept the legacy array during rolling deployments, but prefer the
      // documented { plants, count } response from the hardened backend.
      const result = Array.isArray(data) ? data : data.plants;
      setPlants(Array.isArray(result) ? result : []);
      setPhase('ready');
    } catch (e) {
      setFetchError((e as Error).message || 'Could not load nearby plants.');
      setPhase('ready');
      setPlants([]);
    }
    loadDiscovered(c, radius);
  }, [loadDiscovered]);"""
if old_load in text:
    text = text.replace(old_load, new_load, 1)
elif 'NearbyPlantsResponse | NearbyPlant[]' not in text:
    raise SystemExit('Frontend loader did not match expected source; refusing unsafe edit')
frontend.write_text(text, encoding='utf-8')

placeholder = Path('rmc-app/src/components/Bottomnav.tsx')
if placeholder.exists():
    bad = placeholder.read_text(encoding='utf-8')
    if '__placeholder' in bad or "from 'express'" in bad or '```typescript' in bad:
        placeholder.unlink()
