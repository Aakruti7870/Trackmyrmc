import { randomBytes } from 'node:crypto';
import { getSettings, setSetting } from './settings.js';

// ---------------------------------------------------------------------------
// Aadhaar KYC via DigiLocker, brokered by an aggregator (default: Sandbox,
// https://api.sandbox.co.in). This module is the ONLY place that knows the
// vendor wire format — routes talk to the abstract KycProvider interface, so
// swapping aggregators is a change confined to this file.
//
// Configuration lives in app_settings (editable from the admin panel) with an
// environment-variable fallback for each key. Secrets (api key/secret) are
// NEVER returned to the client — getKycConfig() only reports whether they are
// present. Nothing here fabricates a result: when unconfigured, isKycConfigured
// is false and the routes return a clear 503 instead of a fake verification.
// ---------------------------------------------------------------------------

export const KYC_KEYS = {
  provider: 'kyc_provider',
  enabled: 'kyc_enabled',
  baseUrl: 'kyc_base_url',
  apiKey: 'kyc_api_key',
  apiSecret: 'kyc_api_secret',
  apiVersion: 'kyc_api_version',
} as const;

const DEFAULT_PROVIDER = 'sandbox';
const DEFAULT_BASE_URL = 'https://api.sandbox.co.in';
const DEFAULT_API_VERSION = '2.0';

export interface KycConfig {
  provider: string;
  enabled: boolean;
  baseUrl: string;
  apiVersion: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  // True only when the toggle is on AND every credential needed to actually
  // reach the aggregator is present. The one flag the UI/routes gate on.
  configured: boolean;
}

interface KycSecrets {
  provider: string;
  baseUrl: string;
  apiVersion: string;
  apiKey: string;
  apiSecret: string;
}

// Read effective config: app_settings wins over env, env over built-in default.
async function resolve(): Promise<{ config: KycConfig; secrets: KycSecrets }> {
  const s = await getSettings(Object.values(KYC_KEYS));
  const pick = (key: string, env: string | undefined, dflt = ''): string =>
    (s[key] ?? env ?? dflt).trim();

  const provider = pick(KYC_KEYS.provider, process.env.KYC_PROVIDER, DEFAULT_PROVIDER);
  const baseUrl = pick(KYC_KEYS.baseUrl, process.env.KYC_BASE_URL, DEFAULT_BASE_URL).replace(/\/+$/, '');
  const apiVersion = pick(KYC_KEYS.apiVersion, process.env.KYC_API_VERSION, DEFAULT_API_VERSION);
  const apiKey = pick(KYC_KEYS.apiKey, process.env.KYC_API_KEY);
  const apiSecret = pick(KYC_KEYS.apiSecret, process.env.KYC_API_SECRET);
  // Enabled defaults to true so that simply supplying credentials turns the
  // feature on; an explicit 'false' is the kill switch.
  const enabledRaw = pick(KYC_KEYS.enabled, process.env.KYC_ENABLED, 'true');
  const enabled = enabledRaw !== 'false';

  const configured = enabled && Boolean(baseUrl && apiKey && apiSecret);

  return {
    config: {
      provider,
      enabled,
      baseUrl,
      apiVersion,
      hasApiKey: Boolean(apiKey),
      hasApiSecret: Boolean(apiSecret),
      configured,
    },
    secrets: { provider, baseUrl, apiVersion, apiKey, apiSecret },
  };
}

export async function getKycConfig(): Promise<KycConfig> {
  return (await resolve()).config;
}

export async function isKycConfigured(): Promise<boolean> {
  return (await resolve()).config.configured;
}

// Persist a subset of settings. A blank string clears the stored override (so
// the env/default takes back over); undefined leaves the key untouched.
export async function updateKycSettings(patch: {
  enabled?: boolean;
  provider?: string;
  baseUrl?: string;
  apiVersion?: string;
  apiKey?: string;
  apiSecret?: string;
}): Promise<void> {
  if (patch.enabled !== undefined) await setSetting(KYC_KEYS.enabled, String(patch.enabled));
  if (patch.provider !== undefined) await setSetting(KYC_KEYS.provider, patch.provider.trim() || null);
  if (patch.baseUrl !== undefined) await setSetting(KYC_KEYS.baseUrl, patch.baseUrl.trim() || null);
  if (patch.apiVersion !== undefined) await setSetting(KYC_KEYS.apiVersion, patch.apiVersion.trim() || null);
  if (patch.apiKey !== undefined) await setSetting(KYC_KEYS.apiKey, patch.apiKey.trim() || null);
  if (patch.apiSecret !== undefined) await setSetting(KYC_KEYS.apiSecret, patch.apiSecret.trim() || null);
}

// A short opaque token we embed in our callback URL so a returning consent flow
// maps back to exactly one attempt without trusting the vendor to echo its id.
export function newProviderRef(): string {
  return randomBytes(24).toString('hex');
}

// ---------------------------------------------------------------------------
// Provider abstraction
// ---------------------------------------------------------------------------

export interface KycStartResult {
  // Where to send the customer to complete DigiLocker consent.
  authUrl: string;
  // The aggregator's own session/transaction id (persisted as providerTxnId).
  txnId: string;
}

export interface KycFetchResult {
  status: 'verified' | 'failed';
  maskedAadhaar?: string;
  fullName?: string;
  dob?: string;
  gender?: string;
  error?: string;
}

export interface KycProvider {
  readonly name: string;
  // Create a DigiLocker consent session. `redirectUrl` is our public callback
  // (already carrying ?ref=<providerRef>).
  start(redirectUrl: string): Promise<KycStartResult>;
  // Fetch the eKYC result for a completed session by the aggregator's txn id.
  fetch(txnId: string): Promise<KycFetchResult>;
}

class KycError extends Error {}

// Pull the first present value across a list of candidate keys (aggregators
// disagree on exact field names; keeping the tolerance here isolates churn).
function firstOf(obj: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return undefined;
}

function asObject(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined;
}

// Defence-in-depth: we must NEVER persist a full Aadhaar number. Aggregators
// are supposed to return an already-masked value, but field names/formats vary,
// so we normalise every candidate here before it can reach the database:
//   - a value that is (or contains) 12 consecutive digits is treated as a raw
//     Aadhaar and collapsed to the canonical XXXXXXXX#### (last 4 only);
//   - an already-masked value (Xs/asterisks + last 4) is canonicalised to Xs;
//   - anything without a recoverable last-4 group is rejected (undefined).
// The callback only stores what this returns, so a full number can never land
// in kyc_verifications.masked_aadhaar even if the vendor sends one.
export function toMaskedAadhaar(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const digitsOnly = raw.replace(/\D/g, '');
  if (digitsOnly.length === 12) {
    return `XXXXXXXX${digitsOnly.slice(-4)}`;
  }
  // Masked forms like "XXXX-XXXX-1234", "**** **** 1234" — grab the trailing 4.
  const m = /(\d{4})\s*$/.exec(raw.trim());
  if (m && /[X*x·•\s-]/.test(raw.replace(/\d/g, ''))) {
    return `XXXXXXXX${m[1]}`;
  }
  return undefined;
}

// Sandbox (sandbox.co.in) DigiLocker adapter. Endpoint paths and response
// field names are grouped here as the single point to adjust against the live
// API docs. Auth is a two-step handshake: exchange key+secret for a short-lived
// access token, then call the DigiLocker endpoints with it.
class SandboxKycProvider implements KycProvider {
  readonly name = 'sandbox';
  constructor(private readonly s: KycSecrets) {}

  private async authenticate(): Promise<string> {
    const res = await fetch(`${this.s.baseUrl}/authenticate`, {
      method: 'POST',
      headers: {
        'x-api-key': this.s.apiKey,
        'x-api-secret': this.s.apiSecret,
        'x-api-version': this.s.apiVersion,
      },
    });
    const body = await safeJson(res);
    const token = firstOf(asObject(body), ['access_token']) ?? firstOf(asObject(asObject(body)?.data), ['access_token']);
    if (!res.ok || !token) {
      throw new KycError(`authenticate failed (${res.status})`);
    }
    return token;
  }

  async start(redirectUrl: string): Promise<KycStartResult> {
    const token = await this.authenticate();
    const res = await fetch(`${this.s.baseUrl}/kyc/digilocker/session`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'x-api-key': this.s.apiKey,
        'x-api-version': this.s.apiVersion,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ redirect_url: redirectUrl }),
    });
    const body = await safeJson(res);
    const data = asObject(asObject(body)?.data) ?? asObject(body);
    const authUrl = firstOf(data, ['authorization_url', 'url', 'consent_url', 'redirect_url']);
    const txnId = firstOf(data, ['transaction_id', 'reference_id', 'id', 'session_id']);
    if (!res.ok || !authUrl || !txnId) {
      throw new KycError(`create session failed (${res.status})`);
    }
    return { authUrl, txnId };
  }

  async fetch(txnId: string): Promise<KycFetchResult> {
    const token = await this.authenticate();
    const res = await fetch(`${this.s.baseUrl}/kyc/digilocker/${encodeURIComponent(txnId)}/aadhaar`, {
      method: 'GET',
      headers: {
        Authorization: token,
        'x-api-key': this.s.apiKey,
        'x-api-version': this.s.apiVersion,
      },
    });
    const body = await safeJson(res);
    if (!res.ok) {
      return { status: 'failed', error: `fetch failed (${res.status})` };
    }
    const data = asObject(asObject(body)?.data) ?? asObject(body);
    // Normalise/mask BEFORE anything leaves this method so a raw Aadhaar can
    // never propagate to the caller (and thence to the DB). `reference_id` is
    // intentionally excluded here — it is not an Aadhaar and must not be shown
    // as one.
    const maskedAadhaar = toMaskedAadhaar(
      firstOf(data, ['masked_aadhaar', 'masked_aadhaar_number', 'aadhaar_number']),
    );
    const fullName = firstOf(data, ['name', 'full_name']);
    const dob = firstOf(data, ['date_of_birth', 'dob']);
    const gender = firstOf(data, ['gender']);
    // A verification is only real if we came away with a valid masked Aadhaar.
    // Demographics alone (name/dob) must never flip the badge to verified.
    if (!maskedAadhaar) {
      return { status: 'failed', error: 'no masked Aadhaar returned' };
    }
    return { status: 'verified', maskedAadhaar, fullName, dob, gender };
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

// Resolve the configured provider. Throws if not configured — callers must gate
// on isKycConfigured() first and surface a 503.
export async function getKycProvider(): Promise<KycProvider> {
  const { config, secrets } = await resolve();
  if (!config.configured) throw new KycError('KYC is not configured');
  switch (secrets.provider) {
    case 'sandbox':
    default:
      return new SandboxKycProvider(secrets);
  }
}
