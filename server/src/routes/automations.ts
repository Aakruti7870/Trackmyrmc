import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  AUTOMATIONS,
  AUTOMATION_DEFS,
  getEffectiveAutomation,
  getLastRunMap,
  isAutomationName,
  lastSentAt,
  listRecentSends,
  loadAutomationSnapshot,
  sanitizeConfig,
  saveAutomationSettings,
} from '../lib/automations.js';
import { appBaseUrl, tickAutomations, tickAutomationsForPlant } from '../lib/automationJobs.js';

// Admin configuration for the automation suite. Scope model: a plant-scoped
// actor (plantId set) reads/writes their PLANT's override rows; a platform
// actor (plantId null — authority or a global admin) reads/writes the
// platform-wide defaults. Nobody can reach across into another plant's scope
// because the scope is always derived from the token, never the request body.
const router = Router();
router.use(requireAuth);
router.use(requireRole('admin', 'authority', 'plant_owner'));

router.get('/', async (req, res) => {
  const plantId = req.user!.plantId ?? null;
  const snapshot = await loadAutomationSnapshot();
  const [lastRun, lastSent] = await Promise.all([getLastRunMap(), lastSentAt(plantId)]);

  const items = AUTOMATIONS.map((name) => {
    const def = AUTOMATION_DEFS[name];
    const eff = snapshot.effective(name, plantId);
    return {
      name,
      label: def.label,
      description: def.description,
      enabled: eff.enabled,
      config: eff.config,
      source: eff.source,
      defaultConfig: def.defaultConfig,
      lastRunAt: lastRun[name] ?? null,
      lastSentAt: lastSent[name] ?? null,
    };
  });
  // Trip-share (and any other link-bearing automation) silently skips when no
  // trusted public base URL is configured; expose that so the UI can warn.
  res.json({ scope: plantId ? 'plant' : 'global', plantId, shareBaseConfigured: appBaseUrl() != null, items });
});

// Per-automation activity feed: what the automation actually did (who was
// notified / what was purged), straight from the once-only claim ledger.
// Scope comes from the token: a plant-scoped actor sees only their plant's
// rows; platform staff see everything (including platform-wide cleanup rows).
router.get('/:name/sends', async (req, res) => {
  const name = String(req.params.name);
  if (!isAutomationName(name)) {
    res.status(404).json({ error: 'Unknown automation' });
    return;
  }
  const plantId = req.user!.plantId ?? null;
  const limit = Number(req.query.limit) || 20;
  const items = await listRecentSends(name, plantId, limit);
  res.json({ items });
});

router.put('/:name', async (req, res) => {
  const name = String(req.params.name);
  if (!isAutomationName(name)) {
    res.status(404).json({ error: 'Unknown automation' });
    return;
  }
  const plantId = req.user!.plantId ?? null;
  // Cleanup is platform housekeeping — only platform-level staff may change it,
  // and plant overrides are never consulted by the job.
  if (name === 'cleanup' && plantId != null) {
    res.status(403).json({ error: 'Auto-cleanup is managed platform-wide.' });
    return;
  }
  if (typeof req.body?.enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled (boolean) is required.' });
    return;
  }

  const config = sanitizeConfig(name, req.body?.config);
  await saveAutomationSettings(name, plantId, req.body.enabled, config);
  const eff = await getEffectiveAutomation(name, plantId);
  res.json({ name, enabled: eff.enabled, config: eff.config, source: eff.source });
});

// Manual "run now": kicks one tick immediately. Safe to spam — every send is
// arbitrated by the once-only claim ledger, so this can never double-notify.
// A platform actor runs the full tick (every plant + cleanup); a plant-scoped
// actor gets a tick filtered to THEIR plant only, with global housekeeping
// (cleanup) always skipped — the scope comes from the token, never the body.
router.post('/run', async (req, res) => {
  const plantId = req.user!.plantId ?? null;
  if (plantId != null) {
    await tickAutomationsForPlant(plantId);
  } else {
    await tickAutomations();
  }
  res.json({ ok: true, scope: plantId != null ? 'plant' : 'global' });
});

export default router;
