import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..', '..');
const repoRoot = resolve(appRoot, '..');

describe('About Plant and Paid Ad routing', () => {
  it('registers customer, owner and Super Admin routes', () => {
    const app = readFileSync(resolve(appRoot, 'src/App.tsx'), 'utf8');
    expect(app).toContain('/plants/:plantId/about');
    expect(app).toContain('/plant/profile-management');
    expect(app).toContain('/admin/plant-profiles');
    expect(app).toContain('/admin/plant-promotions');
    expect(app).toContain('About Plant Profile');
  });

  it('shows Super Admin buttons for profile reviews and Paid Ad activation', () => {
    const command = readFileSync(resolve(appRoot, 'src/pages/CommandCenter.tsx'), 'utf8');
    expect(command).toContain('Plant Profile Reviews');
    expect(command).toContain('Activate Paid Ad');
    expect(command).toContain('href="/admin/plant-profiles"');
    expect(command).toContain('href="/admin/plant-promotions"');
  });

  it('serves the Super Admin pages through the production SPA fallback', () => {
    const server = readFileSync(resolve(repoRoot, 'server/src/index.ts'), 'utf8');
    expect(server).toContain("'/admin/plant-profiles'");
    expect(server).toContain("'/admin/plant-promotions'");
  });
});
