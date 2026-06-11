import { Router } from 'express';
import { and, desc, eq, gte, lte, or, ilike, isNotNull, count, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('admin', 'authority'));

const selectCols = {
  id: auditLogs.id,
  actorId: auditLogs.actorId,
  actorName: auditLogs.actorName,
  action: auditLogs.action,
  targetUserId: auditLogs.targetUserId,
  targetUserEmail: auditLogs.targetUserEmail,
  detail: auditLogs.detail,
  emailSent: auditLogs.emailSent,
  createdAt: auditLogs.createdAt,
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/audit-logs
 * Returns the full audit trail across every target type, newest first, with
 * optional filtering. All params are optional and combine with AND:
 *   - action   comma-separated list of action keys (OR within the list)
 *   - actorId  restrict to a single actor (who performed the action)
 *   - targetUserId  restrict to a single target account
 *   - from / to     inclusive date range (ISO timestamp or YYYY-MM-DD)
 *   - q        free-text match across actor, target email, detail and action
 *   - limit    max rows (default 200, capped at 1000)
 *   - offset   number of rows to skip for paging (default 0)
 */
router.get('/', async (req, res) => {
  const conditions: SQL[] = [];

  const actionParam = typeof req.query.action === 'string' ? req.query.action.trim() : '';
  if (actionParam) {
    const actions = actionParam.split(',').map(a => a.trim()).filter(Boolean);
    if (actions.length === 1) {
      conditions.push(eq(auditLogs.action, actions[0]));
    } else if (actions.length > 1) {
      const ors = actions.map(a => eq(auditLogs.action, a));
      conditions.push(or(...ors)!);
    }
  }

  if (req.query.actorId !== undefined) {
    const actorId = parseInt(String(req.query.actorId), 10);
    if (isNaN(actorId)) { res.status(400).json({ error: 'Invalid actorId' }); return; }
    conditions.push(eq(auditLogs.actorId, actorId));
  }

  if (req.query.targetUserId !== undefined) {
    const targetUserId = parseInt(String(req.query.targetUserId), 10);
    if (isNaN(targetUserId)) { res.status(400).json({ error: 'Invalid targetUserId' }); return; }
    conditions.push(eq(auditLogs.targetUserId, targetUserId));
  }

  const fromParam = typeof req.query.from === 'string' ? req.query.from.trim() : '';
  if (fromParam) {
    const d = new Date(fromParam);
    if (isNaN(d.getTime())) { res.status(400).json({ error: 'Invalid from date' }); return; }
    conditions.push(gte(auditLogs.createdAt, d));
  }

  const toParam = typeof req.query.to === 'string' ? req.query.to.trim() : '';
  if (toParam) {
    const d = new Date(toParam);
    if (isNaN(d.getTime())) { res.status(400).json({ error: 'Invalid to date' }); return; }
    // A date-only value (YYYY-MM-DD) should include the whole day.
    if (DATE_ONLY.test(toParam)) d.setHours(23, 59, 59, 999);
    conditions.push(lte(auditLogs.createdAt, d));
  }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q) {
    const like = `%${q}%`;
    conditions.push(or(
      ilike(auditLogs.actorName, like),
      ilike(auditLogs.targetUserEmail, like),
      ilike(auditLogs.detail, like),
      ilike(auditLogs.action, like),
    )!);
  }

  let limit = 200;
  if (req.query.limit !== undefined) {
    const parsed = parseInt(String(req.query.limit), 10);
    if (!isNaN(parsed) && parsed > 0) limit = Math.min(parsed, 1000);
  }

  let offset = 0;
  if (req.query.offset !== undefined) {
    const parsed = parseInt(String(req.query.offset), 10);
    if (isNaN(parsed) || parsed < 0) { res.status(400).json({ error: 'Invalid offset' }); return; }
    offset = parsed;
  }

  const where = conditions.length ? and(...conditions) : undefined;
  // Fetch one extra row so the client can tell whether more pages remain, and a
  // lightweight COUNT (honoring the same filters) so the client can show the
  // exact total and offer jump-to-page controls.
  const [rows, [{ value: total }]] = await Promise.all([
    db.select(selectCols).from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit + 1)
      .offset(offset),
    db.select({ value: count() }).from(auditLogs).where(where),
  ]);

  const hasMore = rows.length > limit;
  // Some pg drivers serialize COUNT as a string; normalize to a number.
  res.json({ rows: hasMore ? rows.slice(0, limit) : rows, hasMore, total: Number(total) });
});

/**
 * GET /api/audit-logs/facets
 * Distinct values used to populate the filter dropdowns: every action key that
 * has ever been logged, and every distinct actor (id + preserved name).
 */
router.get('/facets', async (_req, res) => {
  const actionRows = await db.selectDistinct({ action: auditLogs.action })
    .from(auditLogs)
    .orderBy(auditLogs.action);

  const actorRows = await db.selectDistinct({
    id: auditLogs.actorId,
    name: auditLogs.actorName,
  }).from(auditLogs)
    .where(isNotNull(auditLogs.actorId))
    .orderBy(auditLogs.actorName);

  res.json({
    actions: actionRows.map(r => r.action),
    actors: actorRows
      .filter(r => r.id !== null)
      .map(r => ({ id: r.id as number, name: r.name })),
  });
});

export default router;
