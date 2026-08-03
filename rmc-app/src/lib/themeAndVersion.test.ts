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

describe('Android release metadata — v1.32 / versionCode 33', () => {
  it('build.gradle declares versionCode 33 and versionName "1.32"', () => {
    const gradle = readFileSync(resolve(rmcAppRoot, 'android/app/build.gradle'), 'utf8');
    expect(gradle).toMatch(/versionCode\s+33\b/);
    expect(gradle).toMatch(/versionName\s+"1\.32"/);
    expect(gradle).not.toMatch(/versionCode\s+30\b/);
    expect(gradle).not.toMatch(/versionName\s+"1\.29"/);
  });

  it('rmc-app/package.json version matches the Android release', () => {
    const pkg = JSON.parse(readFileSync(resolve(rmcAppRoot, 'package.json'), 'utf8'));
    expect(pkg.version).toBe('1.32.0');
  });

  it('one-off per-version build workflows are retired in favor of the general signed-release workflow', () => {
    const wfDir = resolve(repoRoot, '.github/workflows');
    for (const stale of ['android-v1.17-build.yml', 'android-v1.18-build.yml', 'android-v1.19-build.yml']) {
      expect(() => readFileSync(resolve(wfDir, stale), 'utf8')).toThrow();
    }
  });

  it('the signed release workflow uploads a v1.32 / vc33-named artifact', () => {
    const signed = readFileSync(resolve(repoRoot, '.github/workflows/android-signed-release.yml'), 'utf8');
    expect(signed).toContain('TrackMyRMC-v1.32-vc33-signed-play-console');
  });
});
