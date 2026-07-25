import type { RequestHandler } from 'express';

/**
 * District and Maharashtra-wide Google Places imports are deliberately disabled
 * unless an operator explicitly enables them in the Cloud Run environment.
 * Market imports remain available for low-cost staged discovery.
 */
export const rmcBulkImportGuard: RequestHandler = (req, res, next) => {
  const scope = typeof req.body?.scope === 'string' ? req.body.scope.toUpperCase() : '';
  const bulkEnabled = process.env.RMC_IMPORT_ENABLE_BULK_SCOPES === 'true';

  if ((scope === 'DISTRICT' || scope === 'MAHARASHTRA') && !bulkEnabled) {
    res.status(403).json({
      error: 'District and Maharashtra RMC imports are disabled. Set RMC_IMPORT_ENABLE_BULK_SCOPES=true only after single-market staging approval.',
      code: 'RMC_BULK_IMPORT_DISABLED',
    });
    return;
  }

  next();
};
