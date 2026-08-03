import 'dotenv/config';
import { pool } from './index.js';

await pool.query(`
  CREATE TABLE IF NOT EXISTS account_deletion_requests (
    id serial PRIMARY KEY,
    user_id integer REFERENCES users(id) ON DELETE SET NULL,
    full_name text NOT NULL,
    mobile text,
    email text,
    reason text,
    status text NOT NULL DEFAULT 'pending_verification'
      CHECK (status IN ('pending_verification','verified','processing','completed','rejected')),
    rejection_reason text,
    requested_at timestamp NOT NULL DEFAULT now(),
    verified_at timestamp,
    completed_at timestamp,
    updated_at timestamp NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS account_deletion_requests_user_idx ON account_deletion_requests(user_id);
  CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_requests_active_user_unique
    ON account_deletion_requests(user_id)
    WHERE user_id IS NOT NULL AND status NOT IN ('completed','rejected');
`);
console.log('Account deletion migration complete.');
await pool.end();
