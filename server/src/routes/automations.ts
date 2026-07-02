import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  AUTOMATIONS,
  AUTOMATION_DEFS,
  getEffectiveAutomation,
  getLastRunMap,
  isAutomationName,
  lastSentAt,
  loadAutomationSnapshot,
  sanitizeConfig,
  saveAutomationSettings,
} from '../lib/automations.js';
import { tickAutomations } from '../lib/automationJobs.js';

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
  res.json({ scope: plantId ? 'plant' : 'global', plantId, items });
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
// Platform-scoped staff only: the tick spans EVERY plant (digests, follow-ups,
// cleanup), so a plant-bound actor must not be able to trigger global work.
router.post('/run', async (req, res) => {
  if (req.user!.plantId != null) {
    res.status(403).json({ error: 'Manual runs are platform-managed. The scheduler covers your plant automatically.' });
    return;
  }
  await tickAutomations();
  res.json({ ok: true });
});

export default router;
