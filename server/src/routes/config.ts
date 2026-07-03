import { Router } from 'express';
import { getRolePermissionOverrides, getAppVersion, getSocialLinks } from '../lib/adminConfig.js';

const router = Router();

// Public, unauthenticated client bootstrap config. Carries the DB-backed role
// permission overrides (the frontend merges them over its static defaults),
// the admin-set app version string, and the admin-editable social/marketing
// links. Nothing sensitive is exposed here.
router.get('/', async (_req, res) => {
  const [rolePermissionOverrides, appVersion, socialLinks] = await Promise.all([
    getRolePermissionOverrides(),
    getAppVersion(),
    getSocialLinks(),
  ]);
  // Browser-side Google Maps key: prefer a dedicated (domain-restricted)
  // browser key, falling back to the general Maps key. When absent the
  // frontend renders the free OpenStreetMap tiles instead — nothing breaks.
  const googleMapsKey =
    process.env.GOOGLE_MAPS_BROWSER_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_PLACES_API_KEY ||
    '';
  const googleMapsMapId = process.env.GOOGLE_MAPS_MAP_ID || '';
  res.json({
    rolePermissionOverrides,
    appVersion,
    socialLinks,
    ...(googleMapsKey ? { googleMapsKey, googleMapsMapId } : {}),
  });
});

export default router;
