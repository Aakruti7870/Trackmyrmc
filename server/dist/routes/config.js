import { Router } from 'express';
import { getRolePermissionOverrides, getAppVersion } from '../lib/adminConfig.js';
const router = Router();
// Public, unauthenticated client bootstrap config. Carries the DB-backed role
// permission overrides (the frontend merges them over its static defaults) and
// the admin-set app version string. Nothing sensitive is exposed here.
router.get('/', async (_req, res) => {
    const [rolePermissionOverrides, appVersion] = await Promise.all([
        getRolePermissionOverrides(),
        getAppVersion(),
    ]);
    res.json({ rolePermissionOverrides, appVersion });
});
export default router;
