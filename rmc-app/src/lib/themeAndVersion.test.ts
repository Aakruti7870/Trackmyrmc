import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const rmcAppRoot = resolve(here, '..', '..');
const repoRoot = resolve(rmcAppRoot, '..');

describe('automatic theme — no Trust Blue', () => {
  it('the theme token stylesheet defines only concrete-gold and infra-green (no trust-blue references)', () => {
    const css = readFileSync(resolve(rmcAppRoot, 'src/automatic-theme.css'), 'utf8');
    expect(css).toMatch(/concrete-gold/);
    expect(css).toMatch(/infra-green/);
    expect(css.toLowerCase()).not.toContain('trust');
  });
});

describe('Android release metadata — v1.18 / versionCode 19', () => {
  it('build.gradle declares versionCode 19 and versionName "1.18"', () => {
    const gradle = readFileSync(resolve(rmcAppRoot, 'android/app/build.gradle'), 'utf8');
    expect(gradle).toMatch(/versionCode\s+19\b/);
    expect(gradle).toMatch(/versionName\s+"1\.18"/);
    expect(gradle).not.toMatch(/versionCode\s+18\b/);
    expect(gradle).not.toMatch(/versionName\s+"1\.17"/);
  });

  it('the v1.18 GitHub Actions build workflow exists and no v1.17 workflow remains', () => {
    const wfDir = resolve(repoRoot, '.github/workflows');
    const v18 = readFileSync(resolve(wfDir, 'android-v1.18-build.yml'), 'utf8');
    expect(v18).toContain('Android v1.18 Build');
    expect(v18).toContain('TrackMyRMC-v1.18-vc19-unsigned');
    expect(() => readFileSync(resolve(wfDir, 'android-v1.17-build.yml'), 'utf8')).toThrow();
  });

  it('the signed release workflow uploads a v1.18 / vc19-named artifact', () => {
    const signed = readFileSync(resolve(repoRoot, '.github/workflows/android-signed-release.yml'), 'utf8');
    expect(signed).toContain('TrackMyRMC-v1.18-vc19-signed-play-console');
  });
});
