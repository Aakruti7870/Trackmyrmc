// TEMPORARY helper: prints your original secret values (recovered from git history)
// so you can paste them into the Secrets tab. The agent will delete this file after.
import { execSync } from 'node:child_process';

const COMMIT = 'b8e6e58'; // last commit whose .replit still had the original values
const KEYS = ['JWT_SECRET', 'VAPID_PRIVATE_KEY', 'WHATSAPP_META_VERIFY_TOKEN', 'REVIEW_DEMO_OTP'];

const replit = execSync(`git show ${COMMIT}:.replit`, { encoding: 'utf8' });

for (const k of KEYS) {
  const m = replit.match(new RegExp('^' + k + ' = "([^"]*)"', 'm'));
  console.log('\n==================== ' + k + ' ====================');
  console.log(m ? m[1] : '(NOT FOUND)');
}
console.log('\n=====================================================');
console.log('For each key above, copy the single line between the banners');
console.log('and paste it into the matching key in the Secrets tab, then Save.');
