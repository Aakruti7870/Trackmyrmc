// TEMPORARY helper: prints your original secret values (recovered from git history)
// in .env format so you can bulk-paste them into the Secrets tab ("Edit as .env").
// The agent will delete this file after.
import { execSync } from 'node:child_process';

const COMMIT = 'b8e6e58'; // last commit whose .replit still had the original values
const KEYS = ['JWT_SECRET', 'VAPID_PRIVATE_KEY', 'WHATSAPP_META_VERIFY_TOKEN', 'REVIEW_DEMO_OTP'];

const replit = execSync(`git show ${COMMIT}:.replit`, { encoding: 'utf8' });

const lines = [];
for (const k of KEYS) {
  const m = replit.match(new RegExp('^' + k + ' = "([^"]*)"', 'm'));
  lines.push(`${k}="${m ? m[1] : ''}"`);
}

process.stderr.write('----- copy everything between the dashed lines -----\n');
process.stdout.write(lines.join('\n') + '\n');
process.stderr.write('---------------------------------------------------\n');
process.stderr.write('Paste it into the Secrets tab -> "Edit as .env" box, then Save.\n');
