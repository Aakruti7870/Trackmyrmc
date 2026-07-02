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
    res.json({ rolePermissionOverrides, appVersion, socialLinks });
});
export default router;
