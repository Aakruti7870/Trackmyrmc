import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetMapEngineForTests,
  configureGoogleMaps,
  getGoogleMapId,
  getMapEngine,
} from './mapEngine';

describe('mapEngine — Google Maps loader with Leaflet fallback', () => {
  beforeEach(() => {
    __resetMapEngineForTests();
    document.head.querySelectorAll('script[src*="maps.googleapis.com"]').forEach(s => s.remove());
    delete window.gm_authFailure;
    delete window.__onGoogleMapsReady;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __resetMapEngineForTests();
  });

  it('stays on leaflet when no key is configured', () => {
    configureGoogleMaps(undefined, undefined);
    expect(getMapEngine()).toBe('leaflet');
    expect(document.head.querySelector('script[src*="maps.googleapis.com"]')).toBeNull();
  });

  it('enters loading and injects the Maps script when a key is supplied', () => {
    configureGoogleMaps('test-key', 'MY_MAP_ID');
    expect(getMapEngine()).toBe('loading');
    expect(getGoogleMapId()).toBe('MY_MAP_ID');
    const script = document.head.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]');
    expect(script).not.toBeNull();
    expect(script!.src).toContain('key=test-key');
    expect(script!.src).toContain('libraries=marker');
  });

  it('falls back to leaflet when Google rejects the key (gm_authFailure)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    configureGoogleMaps('bad-key');
    expect(getMapEngine()).toBe('loading');
    window.gm_authFailure!();
    expect(getMapEngine()).toBe('leaflet');
  });

  it('falls back to leaflet when the script fails to load (onerror)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    configureGoogleMaps('some-key');
    const script = document.head.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]');
    expect(script).not.toBeNull();
    script!.dispatchEvent(new Event('error'));
    expect(getMapEngine()).toBe('leaflet');
  });

  it('switches to google only when the ready callback finds window.google.maps', () => {
    configureGoogleMaps('good-key');
    (window as unknown as { google?: unknown }).google = { maps: {} };
    window.__onGoogleMapsReady!();
    expect(getMapEngine()).toBe('google');
    delete (window as unknown as { google?: unknown }).google;
  });

  it('ignores a second configure call (config is applied once)', () => {
    configureGoogleMaps(undefined);
    configureGoogleMaps('late-key');
    expect(getMapEngine()).toBe('leaflet');
    expect(document.head.querySelector('script[src*="maps.googleapis.com"]')).toBeNull();
  });
});
