import { resumeQueuedRmcImportRuns } from './rmcDiscoveryRunner.js';

// Cloud Run instances can restart between import requests. The job state lives in
// PostgreSQL; on server boot, any queued runs are safely claimed by the runner.
// RUNNING rows are intentionally not blindly replayed because another instance may
// still own them. Operators can cancel/restart a stale RUNNING job from the UI.
if (process.env.NODE_ENV !== 'test') {
  setImmediate(() => {
    void resumeQueuedRmcImportRuns().catch(error => {
      console.error(JSON.stringify({
        event: 'rmc_import_resume_failed',
        error: error instanceof Error ? error.message : String(error),
      }));
    });
  });
}
