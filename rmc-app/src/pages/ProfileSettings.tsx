import { useState, useEffect } from 'react';
import { KeyRound, Eye, EyeOff, CheckCircle, XCircle, User as UserIcon, Mail, Send, History, Lock, Unlock, RefreshCw, PlugZap, Target, Timer, Fuel, ImageUp, MessageCircle, MapPin, Percent, Inbox, Share2, ShieldCheck } from 'lucide-react';
import { api, aiApi, type FuelSettings, type ProofPhotoRetryResult, type StuckProofPhotosResponse, type WhatsAppRetry, type WhatsAppRetriesResponse, type WhatsAppForceRetryResult, type PlantDirectoryEntry, type SocialLinks } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import NotificationsCard from '@/components/NotificationsCard';
import { ROLE_ALLOWED_PATHS, setPermissionOverrides } from '@/lib/permissions';
import type { User } from '@/lib/api';

interface SmtpSettings {
  host: string | null;
  port: string | null;
  user: string | null;
  from: string | null;
  configured: boolean;
}

// The acting owner's own plant. Only the identity/contact fields printed on
// challans & receipts are editable here (status/verification stay marketplace
// admin controlled). A null plantId account (legacy global admin) 404s and the
// whole card stays hidden.
interface PlantProfile {
  id: number;
  plantCode: string | null;
  name: string;
  legalName: string | null;
  gstNo: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  contactNumber: string | null;
}

interface WhatsAppForm {
  enabled: boolean;
  orderEnabled: boolean;
  dispatchEnabled: boolean;
  deliveryEnabled: boolean;
  orderTemplateSid: string;
  dispatchTemplateSid: string;
  deliveryTemplateSid: string;
}

interface WhatsAppSettings extends WhatsAppForm {
  configured: boolean;
}

// Customer Aadhaar KYC (DigiLocker) — the profile badge state (GET /kyc/status).
type KycState = 'unverified' | 'pending' | 'verified' | 'failed';
interface KycStatus {
  configured: boolean;
  status: KycState;
  verifiedAt: string | null;
  maskedAadhaar: string | null;
  fullName: string | null;
  // Optional, backend-supplied — only rendered when present.
  rejectionReason?: string | null;
}

// Platform-staff KYC aggregator config (GET/POST /admin/kyc-settings). Secrets
// are write-only — the server returns only hasApiKey/hasApiSecret.
interface KycConfig {
  provider: string;
  enabled: boolean;
  baseUrl: string;
  apiVersion: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  configured: boolean;
}
interface KycSettingsForm {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  apiVersion: string;
  apiKey: string;
  apiSecret: string;
}

// A single outbound WhatsApp notification + its latest Twilio delivery state,
// joined to the order/challan it was sent for (GET /whatsapp/messages).
interface WhatsAppMessage {
  id: number;
  messageSid: string | null;
  event: string;
  status: string;
  errorCode: string | null;
  toPhone: string | null;
  channel: string;
  createdAt: string;
  updatedAt: string;
  orderId: number | null;
  orderNo: string | null;
  challanId: number | null;
  challanNo: string | null;
}

// Twilio delivery states → badge colour + customer-readable label. Unknown
// states fall back to a neutral grey badge showing the raw status.
const WA_STATUS_BADGE: Record<string, { color: string; label: string }> = {
  queued: { color: 'var(--muted)', label: 'Queued' },
  sending: { color: '#38bdf8', label: 'Sending' },
  sent: { color: '#38bdf8', label: 'Sent' },
  delivered: { color: '#22c55e', label: 'Delivered' },
  read: { color: '#22c55e', label: 'Read' },
  undelivered: { color: '#ef4444', label: 'Undelivered' },
  failed: { color: '#ef4444', label: 'Failed' },
  dev: { color: 'var(--muted)', label: 'Dev (not sent)' },
};

const WA_EVENT_LABEL: Record<string, string> = {
  order: 'Order confirmation',
  dispatch: 'Dispatch update',
  delivery: 'Delivery confirmation',
};

// Delivery states that mean the customer never got the message — staff can
// re-send these (typically after correcting the phone number). Mirrors the
// red-badge statuses above plus the send-time 'error' state.
const WA_FAILED_STATUSES = new Set(['undelivered', 'failed', 'error']);

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 18,
  padding: '28px 30px',
  boxShadow: '0 8px 32px rgba(var(--shadow-rgb),.35)',
};

const label: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700,
  color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 38px 10px 12px',
  background: 'var(--chip-bg)', border: '1px solid var(--line)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
};

// Staff roles an admin may pick as the new-plant-request notification audience.
// Mirrors PLANT_INVITE_NOTIFY_ROLES on the server (client/driver excluded).
const INVITE_NOTIFY_ROLES = ['admin', 'authority', 'dispatcher', 'plant_operator'] as const;
const ROLE_LABEL: Record<(typeof INVITE_NOTIFY_ROLES)[number], string> = {
  admin: 'Admin',
  authority: 'Authority',
  dispatcher: 'Dispatcher',
  plant_operator: 'Plant Operator',
};

// Staff roles the Super Owner may exempt from the one-time-code (2FA) step so
// they can sign in with email + password alone. Mirrors
// STAFF_PASSWORD_LOGIN_ROLES on the server (client & authority excluded — the
// Super Admin's own 2FA can never be switched off).
const STAFF_2FA_ROLES = [
  'admin', 'dispatcher', 'plant_operator', 'plant_owner', 'supervisor', 'accountant',
  'quality_engineer', 'fleet_manager', 'store_manager', 'driver',
] as const;
const STAFF_2FA_ROLE_LABEL: Record<(typeof STAFF_2FA_ROLES)[number], string> = {
  admin: 'Admin',
  dispatcher: 'Dispatcher',
  plant_operator: 'Plant Operator',
  plant_owner: 'Plant Owner',
  supervisor: 'Supervisor',
  accountant: 'Accountant',
  quality_engineer: 'Quality Engineer',
  fleet_manager: 'Fleet Manager',
  store_manager: 'Store Manager',
  driver: 'Driver',
};

type SmtpTestLog = {
  id: number;
  action: string;
  status: string | null;
  detail: string | null;
  actorId: number | null;
  actorName: string | null;
  targetUserEmail: string | null;
  emailSent: boolean | null;
  createdAt: string;
};

const ROLE_COLOR: Record<string, string> = {
  authority: '#e879f9',
  admin: 'var(--gold)',
  dispatcher: 'var(--blue)',
  plant_operator: 'var(--green)',
  client: '#a78bfa',
  driver: '#f97316',
};

interface Lockout {
  key: string;
  count: number;
  lockedUntil: string;
  retryAfterMs: number;
}

function lockoutLabel(key: string): string {
  return key.startsWith('login:') ? key.slice('login:'.length) : key;
}

// Friendly labels for the WhatsApp event behind a queued retry. Mirrors the
// WhatsAppEvent union on the server; an unknown/missing value falls back at the
// call site to a generic "WhatsApp message".
const EVENT_LABEL: Record<string, string> = {
  order: 'Order confirmation',
  dispatch: 'Dispatch update',
  delivery: 'Delivery confirmation',
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'expired';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function PasswordInput({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0,
          display: 'flex', alignItems: 'center',
        }}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function SmtpTextField({
  label: fieldLabel, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label style={label}>{fieldLabel}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, padding: '10px 12px' }}
        autoComplete="off"
      />
    </div>
  );
}

export default function ProfileSettings() {
  const { user, updateUser, logout } = useAuth();
  const { showToast } = useToast();

  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileSaving, setProfileSaving] = useState(false);

  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showDeleteZone, setShowDeleteZone] = useState(false);

  const [plantProfile, setPlantProfile] = useState<PlantProfile | null>(null);
  const [plantForm, setPlantForm] = useState({ name: '', legalName: '', gstNo: '', email: '', address: '', city: '', contactNumber: '' });
  const [plantSaving, setPlantSaving] = useState(false);

  // Customer "default plant" — the orderable plants this account can pick from
  // (GET /plants/directory) and the currently-pinned one (GET /me/preferred-plant).
  // prefPlantSelected is the in-flight selection ('' = none); persisted via PUT.
  const [prefPlantDir, setPrefPlantDir] = useState<PlantDirectoryEntry[]>([]);
  const [prefPlantId, setPrefPlantId] = useState<number | null>(null);
  const [prefPlantSelected, setPrefPlantSelected] = useState<string>('');
  const [prefPlantLoading, setPrefPlantLoading] = useState(false);
  const [prefPlantSaving, setPrefPlantSaving] = useState(false);
  const [prefPlantError, setPrefPlantError] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [testHistory, setTestHistory] = useState<SmtpTestLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings | null>(null);
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpForm, setSmtpForm] = useState({ host: '', port: '', user: '', from: '', pass: '' });
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpVerifying, setSmtpVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [varianceForm, setVarianceForm] = useState({ abs: '', pct: '' });
  const [varianceDefaults, setVarianceDefaults] = useState({ abs: 0.1, pct: 0 });
  const [varianceLoading, setVarianceLoading] = useState(false);
  const [varianceSaving, setVarianceSaving] = useState(false);

  const [commissionForm, setCommissionForm] = useState('');
  const [commissionDefault, setCommissionDefault] = useState(0);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissionSaving, setCommissionSaving] = useState(false);

  const [storageUsage, setStorageUsage] = useState<{ totalFiles: number; byPlant: { plantId: number | null; plantName: string; fileType: string; fileCount: number }[] } | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);

  // Role-permission overrides: a textarea per role holding the effective allowed
  // paths (one per line). On save we diff each role against the static default —
  // unchanged roles are dropped so they keep tracking future default changes.
  const [rolePermForm, setRolePermForm] = useState<Record<string, string>>({});
  const [rolePermLoading, setRolePermLoading] = useState(false);
  const [rolePermSaving, setRolePermSaving] = useState(false);

  const [appVersionForm, setAppVersionForm] = useState('');
  const [appVersionLoading, setAppVersionLoading] = useState(false);
  const [appVersionSaving, setAppVersionSaving] = useState(false);

  const [socialForm, setSocialForm] = useState<SocialLinks>({ youtube: '', instagram: '', facebook: '', whatsapp: '', playStore: '' });
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialSaving, setSocialSaving] = useState(false);

  const [exporting, setExporting] = useState(false);

  const [aiForm, setAiForm] = useState({ enabled: false, persona: '', greeting: '' });
  const [aiDefaults, setAiDefaults] = useState({ persona: '', greeting: '' });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);

  const [inviteNotifyForm, setInviteNotifyForm] = useState<{ emailEnabled: boolean; roles: string[]; recipients: string }>({ emailEnabled: true, roles: ['admin', 'authority'], recipients: '' });
  const [inviteNotifyLoading, setInviteNotifyLoading] = useState(false);
  const [inviteNotifySaving, setInviteNotifySaving] = useState(false);

  // Roles currently allowed to skip the one-time code (2FA OFF → password login).
  const [staff2faExempt, setStaff2faExempt] = useState<string[]>([]);
  const [staff2faLoading, setStaff2faLoading] = useState(false);
  const [staff2faSaving, setStaff2faSaving] = useState(false);

  const [whatsappForm, setWhatsappForm] = useState<WhatsAppForm>({
    enabled: true, orderEnabled: true, dispatchEnabled: true, deliveryEnabled: true,
    orderTemplateSid: '', dispatchTemplateSid: '', deliveryTemplateSid: '',
  });
  const [whatsappConfigured, setWhatsappConfigured] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [whatsappSaving, setWhatsappSaving] = useState(false);

  // Customer KYC (client role): current verification badge + verify flow state.
  const [kyc, setKyc] = useState<KycStatus | null>(null);
  const [kycLoading, setKycLoading] = useState(false);
  const [kycStarting, setKycStarting] = useState(false);
  const [kycError, setKycError] = useState<string | null>(null);
  const [kycPolling, setKycPolling] = useState(false);

  // Driver identity verification (shared /kyc-verification/me profile used by
  // the KYC & Verification page) — read here only to know whether the
  // driver's legal name is approved and must render read-only.
  const [driverKyc, setDriverKyc] = useState<{ status: string; legalName: string | null } | null>(null);

  // Platform-staff KYC aggregator settings.
  const [kycForm, setKycForm] = useState<KycSettingsForm>({
    enabled: true, provider: 'sandbox', baseUrl: '', apiVersion: '', apiKey: '', apiSecret: '',
  });
  const [kycCfg, setKycCfg] = useState<KycConfig | null>(null);
  const [kycCfgLoading, setKycCfgLoading] = useState(false);
  const [kycCfgSaving, setKycCfgSaving] = useState(false);

  const [whatsappMessages, setWhatsappMessages] = useState<WhatsAppMessage[]>([]);
  const [whatsappMessagesLoading, setWhatsappMessagesLoading] = useState(false);
  const [whatsappMessagesReload, setWhatsappMessagesReload] = useState(0);
  const [retries, setRetries] = useState<WhatsAppRetry[]>([]);
  const [retriesLoading, setRetriesLoading] = useState(false);
  const [retriesReload, setRetriesReload] = useState(0);
  // Id of the row whose cancel/retry request is currently in flight.
  const [retryActingId, setRetryActingId] = useState<number | null>(null);
  const [whatsappResendingId, setWhatsappResendingId] = useState<number | null>(null);

  const [idleForm, setIdleForm] = useState({ freeMin: '', ratePerHour: '' });
  const [idleDefaults, setIdleDefaults] = useState<{ freeMin: number; ratePerHour: number | null }>({ freeMin: 45, ratePerHour: null });
  const [idleLoading, setIdleLoading] = useState(false);
  const [idleSaving, setIdleSaving] = useState(false);

  const [fuelForm, setFuelForm] = useState({ reconVariancePct: '', idleBurnLph: '', unscheduledStopMin: '', routeDeviationM: '', plantLat: '', plantLng: '' });
  const [fuelDefaults, setFuelDefaults] = useState<FuelSettings['defaults'] | null>(null);
  const [fuelLoading, setFuelLoading] = useState(false);
  const [fuelSaving, setFuelSaving] = useState(false);

  const [lockouts, setLockouts] = useState<Lockout[]>([]);
  const [lockoutsLoading, setLockoutsLoading] = useState(false);
  const [clearingKey, setClearingKey] = useState<string | null>(null);

  const [stuckPhotos, setStuckPhotos] = useState<number | null>(null);
  const [stuckLoading, setStuckLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<ProofPhotoRetryResult | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [syncedUserId, setSyncedUserId] = useState(user?.id);

  const isAdmin = user?.role === 'admin' || user?.role === 'authority';
  const isClient = user?.role === 'client';
  const isDriver = user?.role === 'driver';
  const isPlatformStaff = isAdmin && (user?.plantId == null);
  // Customer and driver accounts never show or edit the raw role field, and
  // their verified legal name can only change through re-verification — staff
  // and admin roles keep the existing read-only role display.
  const hasIdentityRestrictions = isClient || isDriver;
  const verifiedLegalName = isClient
    ? (kyc?.status === 'verified' ? kyc?.fullName : null)
    : isDriver
      ? (driverKyc?.status === 'approved' ? driverKyc?.legalName : null)
      : null;
  const hasVerifiedLegalName = !!verifiedLegalName;

  // Populate the editable profile fields when the signed-in user loads/changes.
  // Done during render (React's documented adjust-on-change pattern) so it does
  // not require an effect that synchronously calls setState.
  if (user && user.id !== syncedUserId) {
    setSyncedUserId(user.id);
    setProfileName(user.name);
    setProfileEmail(user.email);
  }

  // Bumping these counters re-runs the corresponding load effect (used by the
  // manual "Refresh" buttons) without calling a setState-heavy callback directly
  // from inside an effect.
  const [historyReload, setHistoryReload] = useState(0);
  const [lockoutsReload, setLockoutsReload] = useState(0);

  // Probe the acting account's own plant. A 404 (legacy global admin / authority
  // with no plantId, or a non-owner) simply leaves the card hidden.
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function loadPlant() {
      try {
        const p = await api.get<PlantProfile>('/plants/mine');
        if (cancelled) return;
        setPlantProfile(p);
        setPlantForm({
          name: p.name ?? '', legalName: p.legalName ?? '', gstNo: p.gstNo ?? '',
          email: p.email ?? '', address: p.address ?? '', city: p.city ?? '',
          contactNumber: p.contactNumber ?? '',
        });
      } catch {
        if (!cancelled) setPlantProfile(null); // not a plant owner — hide the card
      }
    }
    loadPlant();
    return () => { cancelled = true; };
  }, [isAdmin]);

  // Customers only: load the orderable plant directory and the currently-pinned
  // default plant so the selector can show + change it. Best-effort; failures
  // simply leave the control empty/unset.
  useEffect(() => {
    if (!isClient) return;
    let cancelled = false;
    function loadPreferredPlant() {
      setPrefPlantLoading(true);
      setPrefPlantError(false);
      Promise.all([
        api.get<PlantDirectoryEntry[]>('/plants/directory'),
        api.get<{ plantId: number | null }>('/me/preferred-plant'),
      ])
        .then(([dir, pref]) => {
          if (cancelled) return;
          setPrefPlantDir(dir);
          setPrefPlantId(pref?.plantId ?? null);
          setPrefPlantSelected(pref?.plantId != null ? String(pref.plantId) : '');
        })
        .catch(() => { if (!cancelled) setPrefPlantError(true); })
        .finally(() => { if (!cancelled) setPrefPlantLoading(false); });
    }
    loadPreferredPlant();
    return () => { cancelled = true; };
  }, [isClient, user?.id]);

  // Customers only: load the current KYC verification badge state.
  useEffect(() => {
    if (!isClient) return;
    let cancelled = false;
    function loadKyc() {
      setKycLoading(true);
      api.get<KycStatus>('/kyc/status')
        .then(s => { if (!cancelled) setKyc(s); })
        .catch(() => { /* best-effort — the card falls back to "unverified" */ })
        .finally(() => { if (!cancelled) setKycLoading(false); });
    }
    loadKyc();
    return () => { cancelled = true; };
  }, [isClient, user?.id]);

  // Drivers only: read the shared identity-verification profile (same data as
  // the KYC & Verification page) so an approved legal name renders read-only
  // here too. Best-effort — the field just stays editable if this fails.
  useEffect(() => {
    if (!isDriver) return;
    let cancelled = false;
    api.get<{ profile: { status: string; legalName: string | null } | null }>('/kyc-verification/me')
      .then(({ profile }) => { if (!cancelled) setDriverKyc(profile); })
      .catch(() => { /* best-effort */ });
    return () => { cancelled = true; };
  }, [isDriver, user?.id]);

  // Customers only: while a DigiLocker verification is in progress (the consent
  // flow opened in another tab), poll the status until it settles or we give up.
  useEffect(() => {
    if (!kycPolling) return;
    let cancelled = false;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      api.get<KycStatus>('/kyc/status')
        .then(s => {
          if (cancelled) return;
          setKyc(s);
          if (s.status === 'verified' || s.status === 'failed' || tries >= 30) {
            setKycPolling(false);
            if (s.status === 'verified') showToast('Aadhaar KYC verified.', 'success');
            else if (s.status === 'failed') showToast('KYC verification failed. Please try again.', 'error');
          }
        })
        .catch(() => { if (!cancelled && tries >= 30) setKycPolling(false); });
    }, 4000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [kycPolling, showToast]);

  // Platform staff only: load the KYC aggregator configuration into the form.
  useEffect(() => {
    if (!isPlatformStaff) return;
    let cancelled = false;
    function loadKycCfg() {
      setKycCfgLoading(true);
      api.get<KycConfig>('/admin/kyc-settings')
        .then(cfg => {
          if (cancelled) return;
          setKycCfg(cfg);
          setKycForm({
            enabled: cfg.enabled,
            provider: cfg.provider || 'sandbox',
            baseUrl: cfg.baseUrl ?? '',
            apiVersion: cfg.apiVersion ?? '',
            apiKey: '',
            apiSecret: '',
          });
        })
        .catch(() => { /* best-effort — leaves the form at defaults */ })
        .finally(() => { if (!cancelled) setKycCfgLoading(false); });
    }
    loadKycCfg();
    return () => { cancelled = true; };
  }, [isPlatformStaff]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const rows = await api.get<SmtpTestLog[]>('/admin/email-test/history');
        if (!cancelled) setTestHistory(rows);
      } catch {
        /* ignore — history is non-critical */
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }
    loadHistory();
    return () => { cancelled = true; };
  }, [isAdmin, historyReload]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function loadSmtp() {
      setSmtpLoading(true);
      try {
        const s = await api.get<SmtpSettings>('/admin/smtp-settings');
        if (cancelled) return;
        setSmtpSettings(s);
        // Host and port are not sensitive, so prefill them for easy editing.
        setSmtpForm(f => ({ ...f, host: s.host || '', port: s.port || '' }));
      } catch {
        if (!cancelled) setSmtpSettings(null);
      } finally {
        if (!cancelled) setSmtpLoading(false);
      }
    }
    loadSmtp();
    return () => { cancelled = true; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function loadVariance() {
      setVarianceLoading(true);
      try {
        const v = await api.get<{ abs: number; pct: number }>('/admin/variance-tolerance');
        if (cancelled) return;
        setVarianceForm({ abs: String(v.abs), pct: String(v.pct) });
      } catch {
        /* non-fatal — keep defaults */
      } finally {
        if (!cancelled) setVarianceLoading(false);
      }
    }
    loadVariance();
    return () => { cancelled = true; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function loadCommission() {
      setCommissionLoading(true);
      try {
        const v = await api.get<{ pct: number; default: number }>('/admin/commission');
        if (cancelled) return;
        setCommissionForm(String(v.pct));
        setCommissionDefault(v.default);
      } catch {
        /* non-fatal — keep defaults */
      } finally {
        if (!cancelled) setCommissionLoading(false);
      }
    }
    loadCommission();
    return () => { cancelled = true; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isPlatformStaff) return;
    let cancelled = false;
    function loadStorage() {
      setStorageLoading(true);
      api.get<{ totalFiles: number; byPlant: { plantId: number | null; plantName: string; fileType: string; fileCount: number }[] }>('/files/usage')
        .then(v => { if (!cancelled) setStorageUsage(v); })
        .catch(() => { /* non-fatal */ })
        .finally(() => { if (!cancelled) setStorageLoading(false); });
    }
    loadStorage();
    return () => { cancelled = true; };
  }, [isPlatformStaff]);

  useEffect(() => {
    if (!isPlatformStaff) return;
    let cancelled = false;
    function loadRolePerms() {
      setRolePermLoading(true);
      api.get<{ overrides: Record<string, string[]>; roles: string[] }>('/admin/role-permissions')
        .then(v => {
          if (cancelled) return;
          const form: Record<string, string> = {};
          for (const role of Object.keys(ROLE_ALLOWED_PATHS)) {
            const paths = v.overrides[role] ?? ROLE_ALLOWED_PATHS[role as keyof typeof ROLE_ALLOWED_PATHS];
            form[role] = paths.join('\n');
          }
          setRolePermForm(form);
        })
        .catch(() => { /* non-fatal — leave editor empty */ })
        .finally(() => { if (!cancelled) setRolePermLoading(false); });
    }
    loadRolePerms();
    return () => { cancelled = true; };
  }, [isPlatformStaff]);

  useEffect(() => {
    if (!isPlatformStaff) return;
    let cancelled = false;
    function loadAppVersion() {
      setAppVersionLoading(true);
      api.get<{ version: string }>('/admin/app-version')
        .then(v => { if (!cancelled) setAppVersionForm(v.version ?? ''); })
        .catch(() => { /* non-fatal */ })
        .finally(() => { if (!cancelled) setAppVersionLoading(false); });
    }
    loadAppVersion();
    return () => { cancelled = true; };
  }, [isPlatformStaff]);

  useEffect(() => {
    if (!isPlatformStaff) return;
    let cancelled = false;
    function loadSocialLinks() {
      setSocialLoading(true);
      api.get<{ links: SocialLinks }>('/admin/social-links')
        .then(v => { if (!cancelled && v.links) setSocialForm(v.links); })
        .catch(() => { /* non-fatal */ })
        .finally(() => { if (!cancelled) setSocialLoading(false); });
    }
    loadSocialLinks();
    return () => { cancelled = true; };
  }, [isPlatformStaff]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function loadAi() {
      setAiLoading(true);
      try {
        const v = await aiApi.getSettings();
        if (cancelled) return;
        setAiForm({
          enabled: v.enabled,
          persona: v.persona === v.defaults.persona ? '' : v.persona,
          greeting: v.greeting === v.defaults.greeting ? '' : v.greeting,
        });
        setAiDefaults(v.defaults);
      } catch {
        /* non-fatal — keep defaults */
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    }
    loadAi();
    return () => { cancelled = true; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function loadInviteNotify() {
      setInviteNotifyLoading(true);
      try {
        const v = await api.get<{ emailEnabled: boolean; roles: string[]; recipients: string[] }>('/admin/plant-invite-notify');
        if (cancelled) return;
        setInviteNotifyForm({ emailEnabled: v.emailEnabled, roles: v.roles ?? [], recipients: v.recipients.join(', ') });
      } catch {
        /* non-fatal — keep defaults */
      } finally {
        if (!cancelled) setInviteNotifyLoading(false);
      }
    }
    loadInviteNotify();
    return () => { cancelled = true; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isPlatformStaff) return;
    let cancelled = false;
    async function loadStaff2fa() {
      setStaff2faLoading(true);
      try {
        const v = await api.get<{ roles: string[] }>('/admin/staff-password-login');
        if (cancelled) return;
        setStaff2faExempt(v.roles ?? []);
      } catch {
        /* non-fatal — keep defaults */
      } finally {
        if (!cancelled) setStaff2faLoading(false);
      }
    }
    loadStaff2fa();
    return () => { cancelled = true; };
  }, [isPlatformStaff]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function loadWhatsapp() {
      setWhatsappLoading(true);
      try {
        const v = await api.get<WhatsAppSettings>('/admin/whatsapp-settings');
        if (cancelled) return;
        setWhatsappConfigured(v.configured);
        setWhatsappForm({
          enabled: v.enabled, orderEnabled: v.orderEnabled,
          dispatchEnabled: v.dispatchEnabled, deliveryEnabled: v.deliveryEnabled,
          orderTemplateSid: v.orderTemplateSid ?? '',
          dispatchTemplateSid: v.dispatchTemplateSid ?? '',
          deliveryTemplateSid: v.deliveryTemplateSid ?? '',
        });
      } catch {
        /* non-fatal — keep defaults */
      } finally {
        if (!cancelled) setWhatsappLoading(false);
      }
    }
    loadWhatsapp();
    return () => { cancelled = true; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    function loadWhatsappMessages() {
      setWhatsappMessagesLoading(true);
      api.get<WhatsAppMessage[]>('/whatsapp/messages?limit=25')
        .then(rows => { if (!cancelled) setWhatsappMessages(rows); })
        .catch(() => { /* non-fatal — leave the panel empty */ })
        .finally(() => { if (!cancelled) setWhatsappMessagesLoading(false); });
    }
    loadWhatsappMessages();
    return () => { cancelled = true; };
  }, [isAdmin, whatsappMessagesReload]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function loadRetries() {
      setRetriesLoading(true);
      try {
        const v = await api.get<WhatsAppRetriesResponse>('/admin/whatsapp-retries');
        if (!cancelled) setRetries(Array.isArray(v?.retries) ? v.retries : []);
      } catch {
        /* non-fatal — leave the queue empty */
      } finally {
        if (!cancelled) setRetriesLoading(false);
      }
    }
    loadRetries();
    return () => { cancelled = true; };
  }, [isAdmin, retriesReload]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function loadIdle() {
      setIdleLoading(true);
      try {
        const v = await api.get<{ freeMin: number; ratePerHour: number | null; defaults: { freeMin: number; ratePerHour: number | null } }>('/admin/idle-settings');
        if (cancelled) return;
        setIdleForm({ freeMin: String(v.freeMin), ratePerHour: v.ratePerHour == null ? '' : String(v.ratePerHour) });
        if (v.defaults) setIdleDefaults(v.defaults);
      } catch {
        /* non-fatal — keep defaults */
      } finally {
        if (!cancelled) setIdleLoading(false);
      }
    }
    loadIdle();
    return () => { cancelled = true; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function loadFuel() {
      setFuelLoading(true);
      try {
        const v = await api.get<FuelSettings>('/admin/fuel-settings');
        if (cancelled) return;
        setFuelForm({
          reconVariancePct: String(v.reconVariancePct),
          idleBurnLph: String(v.idleBurnLph),
          unscheduledStopMin: String(v.unscheduledStopMin),
          routeDeviationM: String(v.routeDeviationM),
          plantLat: v.plantLat == null ? '' : String(v.plantLat),
          plantLng: v.plantLng == null ? '' : String(v.plantLng),
        });
        if (v.defaults) setFuelDefaults(v.defaults);
      } catch {
        /* non-fatal — keep defaults */
      } finally {
        if (!cancelled) setFuelLoading(false);
      }
    }
    loadFuel();
    return () => { cancelled = true; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function loadLockouts() {
      setLockoutsLoading(true);
      try {
        const rows = await api.get<Lockout[]>('/admin/lockouts');
        if (!cancelled) setLockouts(rows);
      } catch {
        /* non-fatal */
      } finally {
        if (!cancelled) setLockoutsLoading(false);
      }
    }
    loadLockouts();
    return () => { cancelled = true; };
  }, [isAdmin, lockoutsReload]);

  // Tick every second so the remaining-time countdown stays live.
  useEffect(() => {
    if (!isAdmin || lockouts.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isAdmin, lockouts.length]);

  async function handleClearLockout(key: string) {
    setClearingKey(key);
    try {
      await api.post('/admin/lockouts/clear', { key });
      setLockouts(prev => prev.filter(l => l.key !== key));
      showToast('Lockout cleared.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to clear lockout';
      showToast(msg, 'error');
    } finally {
      setClearingKey(null);
    }
  }

  // Bumped by the "Refresh"/"Retry" buttons to re-run the stuck-photo count load.
  const [stuckReload, setStuckReload] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function loadStuck() {
      setStuckLoading(true);
      try {
        const res = await api.get<StuckProofPhotosResponse>('/admin/proof-photos/stuck');
        if (!cancelled) setStuckPhotos(res.count);
      } catch {
        /* non-fatal */
      } finally {
        if (!cancelled) setStuckLoading(false);
      }
    }
    loadStuck();
    return () => { cancelled = true; };
  }, [isAdmin, stuckReload]);

  async function handleRetryProofPhotos() {
    setRetrying(true);
    setRetryResult(null);
    try {
      const result = await api.post<ProofPhotoRetryResult>('/admin/proof-photos/retry', {});
      setRetryResult(result);
      setStuckReload(n => n + 1);
      if (result.failed > 0) {
        showToast(`${result.migrated} recovered, ${result.failed} still failed.`, 'error');
      } else if (result.migrated > 0) {
        showToast(`All ${result.migrated} stuck photo(s) recovered.`, 'success');
      } else {
        showToast('No stuck photos to recover.', 'success');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retry stuck photos';
      showToast(msg, 'error');
    } finally {
      setRetrying(false);
    }
  }

  async function handleCancelRetry(id: number) {
    setRetryActingId(id);
    try {
      await api.post(`/admin/whatsapp-retries/${id}/cancel`, {});
      setRetries(rs => rs.filter(r => r.id !== id));
      showToast('Queued message cancelled.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel the queued message';
      showToast(msg, 'error');
      setRetriesReload(n => n + 1);
    } finally {
      setRetryActingId(null);
    }
  }

  async function handleForceRetry(id: number) {
    setRetryActingId(id);
    try {
      const res = await api.post<WhatsAppForceRetryResult>(`/admin/whatsapp-retries/${id}/retry`, {});
      if (res.outcome === 'sent') {
        showToast('Message sent.', 'success');
      } else if (res.outcome === 'retried') {
        showToast('Still failing — re-queued for another retry.', 'error');
      } else {
        showToast('Send failed permanently — removed from the queue.', 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to re-send the message';
      showToast(msg, 'error');
    } finally {
      setRetryActingId(null);
      setRetriesReload(n => n + 1);
    }
  }

  // Re-send a notification that failed to reach the customer. The endpoint
  // re-invokes the same notify helper and records a fresh message row; reload
  // the panel so the new attempt's delivery state replaces the failed one.
  async function handleResendWhatsapp(id: number) {
    setWhatsappResendingId(id);
    try {
      const result = await api.post<{ ok: boolean; resent: boolean; message: WhatsAppMessage | null }>(
        `/whatsapp/messages/${id}/resend`, {},
      );
      if (result.resent) {
        showToast('Notification re-sent.', 'success');
      } else {
        showToast('Nothing was re-sent — notifications may be off or the customer has no phone number.', 'error');
      }
      setWhatsappMessagesReload(n => n + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to re-send notification';
      showToast(msg, 'error');
    } finally {
      setWhatsappResendingId(null);
    }
  }

  const roleColor = user ? (ROLE_COLOR[user.role] || 'var(--muted)') : 'var(--muted)';
  const roleLabel = user?.role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) || '';

  // Once identity is verified, the legal name field is read-only, so only the
  // email counts toward "dirty" and only email is ever sent — the protected
  // name is never resubmitted, verified or not.
  const profileDirty = (!hasVerifiedLegalName && profileName !== (user?.name || '')) || profileEmail !== (user?.email || '');

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!hasVerifiedLegalName && !profileName.trim()) {
      showToast('Name cannot be empty.', 'error');
      return;
    }
    if (!profileEmail.trim() || !profileEmail.includes('@')) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    setProfileSaving(true);
    try {
      const { token, user: updated } = await api.put<{ token: string; user: User }>('/auth/me', {
        // The verified legal name is protected server-side too; omitting it
        // here avoids sending a field the customer/driver can no longer edit.
        ...(hasVerifiedLegalName ? {} : { name: profileName.trim() }),
        email: profileEmail.trim(),
      });
      updateUser(updated, token);
      showToast('Profile updated successfully.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : 'Failed to update profile';
      showToast(msg, 'error');
    } finally {
      setProfileSaving(false);
    }
  }

  // Persist the customer's default plant. An empty selection sends plantId:null,
  // which unpins. The response is the source of truth for the saved value.
  async function handlePreferredPlantSave() {
    const next = prefPlantSelected === '' ? null : Number(prefPlantSelected);
    setPrefPlantSaving(true);
    try {
      const r = await api.put<{ plantId: number | null }>('/me/preferred-plant', { plantId: next });
      const saved = r?.plantId ?? null;
      setPrefPlantId(saved);
      setPrefPlantSelected(saved != null ? String(saved) : '');
      showToast(saved == null ? 'Default plant cleared.' : 'Default plant saved.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update your default plant.';
      showToast(msg, 'error');
    } finally {
      setPrefPlantSaving(false);
    }
  }

  async function handlePlantSave(e: React.FormEvent) {
    e.preventDefault();
    if (!plantForm.name.trim()) {
      showToast('Plant name cannot be empty.', 'error');
      return;
    }
    if (plantForm.email.trim() && !plantForm.email.includes('@')) {
      showToast('Please enter a valid plant email address.', 'error');
      return;
    }
    setPlantSaving(true);
    try {
      // Empty string clears an optional field; name is required so it is always sent.
      const updated = await api.put<PlantProfile>('/plants/mine', {
        name: plantForm.name.trim(),
        legalName: plantForm.legalName.trim() || null,
        gstNo: plantForm.gstNo.trim() || null,
        email: plantForm.email.trim() || null,
        address: plantForm.address.trim() || null,
        city: plantForm.city.trim() || null,
        contactNumber: plantForm.contactNumber.trim() || null,
      });
      setPlantProfile(updated);
      showToast('Plant details saved.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save plant details';
      showToast(msg, 'error');
    } finally {
      setPlantSaving(false);
    }
  }

  async function handleSmtpSave(e: React.FormEvent) {
    e.preventDefault();
    const port = smtpForm.port.trim();
    if (port && !/^\d+$/.test(port)) {
      showToast('Port must be a number.', 'error');
      return;
    }
    const from = smtpForm.from.trim();
    if (from && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(from)) {
      showToast('From must be a valid email address.', 'error');
      return;
    }
    setSmtpSaving(true);
    try {
      // Contract: omitted field = keep current, empty string = clear (revert to
      // env), non-empty = set. Host/port are prefilled so we always send them
      // (clearing a prefilled field intentionally clears it). Username, From and
      // password are write-only and only sent when filled, so leaving them blank
      // keeps the stored value — matching the field placeholders.
      const body: Record<string, string> = {
        host: smtpForm.host.trim(),
        port,
      };
      if (smtpForm.user.trim()) body.user = smtpForm.user.trim();
      if (from) body.from = from;
      if (smtpForm.pass.trim()) body.pass = smtpForm.pass;
      const updated = await api.post<SmtpSettings>('/admin/smtp-settings', body);
      setSmtpSettings(updated);
      setSmtpForm(f => ({ ...f, host: updated.host || '', port: updated.port || '', user: '', from: '', pass: '' }));
      showToast('SMTP settings saved.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save SMTP settings';
      showToast(msg, 'error');
    } finally {
      setSmtpSaving(false);
    }
  }

  async function handleVerifyConnection() {
    const port = smtpForm.port.trim();
    if (port && !/^\d+$/.test(port)) {
      showToast('Port must be a number.', 'error');
      return;
    }
    const from = smtpForm.from.trim();
    if (from && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(from)) {
      showToast('From must be a valid email address.', 'error');
      return;
    }
    setSmtpVerifying(true);
    setVerifyResult(null);
    try {
      // Mirror the save contract: host/port are sent as entered (blank falls
      // back to env on the server); username/from/password are only sent when
      // filled, so a blank password tests against the currently stored one.
      const body: Record<string, string> = {
        host: smtpForm.host.trim(),
        port,
      };
      if (smtpForm.user.trim()) body.user = smtpForm.user.trim();
      if (from) body.from = from;
      if (smtpForm.pass.trim()) body.pass = smtpForm.pass;
      await api.post('/admin/smtp-settings/verify', body);
      setVerifyResult({ ok: true, message: 'Connection successful — these settings can reach the mail server.' });
      showToast('SMTP connection verified.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not connect to the mail server.';
      setVerifyResult({ ok: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setSmtpVerifying(false);
      setHistoryReload(n => n + 1);
    }
  }

  async function handleVarianceSave(e: React.FormEvent) {
    e.preventDefault();
    const abs = varianceForm.abs.trim();
    const pct = varianceForm.pct.trim();
    if (abs && (!Number.isFinite(Number(abs)) || Number(abs) < 0)) {
      showToast('Tolerance must be a number of 0 or more.', 'error');
      return;
    }
    if (pct && (!Number.isFinite(Number(pct)) || Number(pct) < 0 || Number(pct) > 100)) {
      showToast('Percentage must be between 0 and 100.', 'error');
      return;
    }
    setVarianceSaving(true);
    try {
      // Empty string clears the value, reverting to the built-in default.
      const updated = await api.post<{ abs: number; pct: number; defaults: { abs: number; pct: number } }>(
        '/admin/variance-tolerance',
        { abs, pct },
      );
      setVarianceForm({ abs: String(updated.abs), pct: String(updated.pct) });
      if (updated.defaults) setVarianceDefaults(updated.defaults);
      showToast('Delivery tolerance saved.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save delivery tolerance';
      showToast(msg, 'error');
    } finally {
      setVarianceSaving(false);
    }
  }

  async function handleCommissionSave(e: React.FormEvent) {
    e.preventDefault();
    const pct = commissionForm.trim();
    if (pct && (!Number.isFinite(Number(pct)) || Number(pct) < 0 || Number(pct) > 100)) {
      showToast('Commission must be between 0 and 100.', 'error');
      return;
    }
    setCommissionSaving(true);
    try {
      const updated = await api.post<{ pct: number; default: number }>('/admin/commission', { pct });
      setCommissionForm(String(updated.pct));
      setCommissionDefault(updated.default);
      showToast('Platform commission saved.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save commission';
      showToast(msg, 'error');
    } finally {
      setCommissionSaving(false);
    }
  }

  async function handleRolePermsSave(e: React.FormEvent) {
    e.preventDefault();
    // Build the overrides map: only roles whose path list differs from the
    // built-in default are sent. Unchanged roles are omitted so they keep
    // tracking future default changes.
    const overrides: Record<string, string[]> = {};
    for (const role of Object.keys(ROLE_ALLOWED_PATHS)) {
      const edited = (rolePermForm[role] ?? '')
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.startsWith('/'));
      const def = ROLE_ALLOWED_PATHS[role as keyof typeof ROLE_ALLOWED_PATHS];
      const same = edited.length === def.length && edited.every((p, i) => p === def[i]);
      if (!same) overrides[role] = edited;
    }
    setRolePermSaving(true);
    try {
      const updated = await api.post<{ overrides: Record<string, string[]> }>('/admin/role-permissions', { overrides });
      const form: Record<string, string> = {};
      for (const role of Object.keys(ROLE_ALLOWED_PATHS)) {
        const paths = updated.overrides[role] ?? ROLE_ALLOWED_PATHS[role as keyof typeof ROLE_ALLOWED_PATHS];
        form[role] = paths.join('\n');
      }
      setRolePermForm(form);
      // Apply immediately in this session too, so the sidebar/menus of the
      // saving admin reflect the new permissions without a full reload.
      setPermissionOverrides(updated.overrides);
      const count = Object.keys(updated.overrides).length;
      showToast(count ? `Saved ${count} role override(s). Menus update immediately; other users see changes on next load.` : 'Cleared all overrides — defaults restored.', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save role permissions', 'error');
    } finally {
      setRolePermSaving(false);
    }
  }

  async function handleAppVersionSave(e: React.FormEvent) {
    e.preventDefault();
    setAppVersionSaving(true);
    try {
      const updated = await api.post<{ version: string }>('/admin/app-version', { version: appVersionForm.trim() });
      setAppVersionForm(updated.version ?? '');
      showToast('App version saved.', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save app version', 'error');
    } finally {
      setAppVersionSaving(false);
    }
  }

  async function handleSocialSave(e: React.FormEvent) {
    e.preventDefault();
    setSocialSaving(true);
    try {
      const updated = await api.post<{ links: SocialLinks }>('/admin/social-links', {
        youtube: socialForm.youtube.trim(),
        instagram: socialForm.instagram.trim(),
        facebook: socialForm.facebook.trim(),
        whatsapp: socialForm.whatsapp.trim(),
        playStore: socialForm.playStore.trim(),
      });
      if (updated.links) setSocialForm(updated.links);
      showToast('Social links saved. Clients see them on next load.', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save social links', 'error');
    } finally {
      setSocialSaving(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await api.download('/admin/export', `trackmyrmc-export-${new Date().toISOString().slice(0, 10)}.json`);
      showToast('Database export downloaded.', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to export database', 'error');
    } finally {
      setExporting(false);
    }
  }

  async function handleAiSave(e: React.FormEvent) {
    e.preventDefault();
    setAiSaving(true);
    try {
      // Empty persona/greeting clears the override, reverting to the default.
      const updated = await aiApi.saveSettings({
        enabled: aiForm.enabled,
        persona: aiForm.persona.trim(),
        greeting: aiForm.greeting.trim(),
      });
      setAiForm({
        enabled: updated.enabled,
        persona: updated.persona === updated.defaults.persona ? '' : updated.persona,
        greeting: updated.greeting === updated.defaults.greeting ? '' : updated.greeting,
      });
      setAiDefaults(updated.defaults);
      showToast('AI assistant settings saved.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save AI assistant settings';
      showToast(msg, 'error');
    } finally {
      setAiSaving(false);
    }
  }

  async function handleInviteNotifySave(e: React.FormEvent) {
    e.preventDefault();
    const recipients = inviteNotifyForm.recipients.trim();
    if (recipients) {
      const bad = recipients
        .split(/[\s,;]+/)
        .map(r => r.trim())
        .filter(Boolean)
        .filter(r => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r));
      if (bad.length) {
        showToast(`Not a valid email: ${bad[0]}`, 'error');
        return;
      }
    }
    setInviteNotifySaving(true);
    try {
      const updated = await api.post<{ emailEnabled: boolean; roles: string[]; recipients: string[] }>(
        '/admin/plant-invite-notify',
        { emailEnabled: inviteNotifyForm.emailEnabled, roles: inviteNotifyForm.roles, recipients },
      );
      setInviteNotifyForm({ emailEnabled: updated.emailEnabled, roles: updated.roles ?? [], recipients: updated.recipients.join(', ') });
      showToast('Notification settings saved.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save notification settings';
      showToast(msg, 'error');
    } finally {
      setInviteNotifySaving(false);
    }
  }

  async function handleStaff2faSave(e: React.FormEvent) {
    e.preventDefault();
    setStaff2faSaving(true);
    try {
      const updated = await api.post<{ roles: string[] }>('/admin/staff-password-login', { roles: staff2faExempt });
      setStaff2faExempt(updated.roles ?? []);
      showToast(
        (updated.roles ?? []).length
          ? 'Saved — the selected roles can now sign in with password only.'
          : 'Saved — every staff role now requires the one-time code.',
        'success',
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save login security settings';
      showToast(msg, 'error');
    } finally {
      setStaff2faSaving(false);
    }
  }

  // Customer: kick off a DigiLocker verification. The server returns a consent
  // URL we open in a new tab; we then poll /kyc/status until it settles. Fails
  // loud (503) when the aggregator isn't configured — never fake-verifies.
  async function handleKycStart() {
    setKycStarting(true);
    setKycError(null);
    try {
      const { authUrl } = await api.post<{ authUrl: string }>('/kyc/start', {});
      if (!authUrl) throw new Error('The verification service did not return a link.');
      const win = window.open(authUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        setKycError('Please allow pop-ups for this site, then tap “Verify with DigiLocker” again.');
        return;
      }
      setKyc(prev => (prev ? { ...prev, status: 'pending' } : prev));
      setKycPolling(true);
      showToast('Complete the Aadhaar consent in the new tab. We’ll update this automatically.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not start verification.';
      setKycError(msg);
    } finally {
      setKycStarting(false);
    }
  }

  // Platform staff: save the KYC aggregator configuration. Blank secret fields
  // are omitted so a saved key/secret is preserved unless explicitly replaced.
  async function handleKycSettingsSave(e: React.FormEvent) {
    e.preventDefault();
    setKycCfgSaving(true);
    try {
      const body: Record<string, unknown> = {
        enabled: kycForm.enabled,
        provider: kycForm.provider.trim() || 'sandbox',
        baseUrl: kycForm.baseUrl.trim(),
        apiVersion: kycForm.apiVersion.trim(),
      };
      if (kycForm.apiKey.trim()) body.apiKey = kycForm.apiKey.trim();
      if (kycForm.apiSecret.trim()) body.apiSecret = kycForm.apiSecret.trim();
      const cfg = await api.post<KycConfig>('/admin/kyc-settings', body);
      setKycCfg(cfg);
      setKycForm({
        enabled: cfg.enabled,
        provider: cfg.provider || 'sandbox',
        baseUrl: cfg.baseUrl ?? '',
        apiVersion: cfg.apiVersion ?? '',
        apiKey: '',
        apiSecret: '',
      });
      showToast('KYC settings saved.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save KYC settings';
      showToast(msg, 'error');
    } finally {
      setKycCfgSaving(false);
    }
  }

  async function handleWhatsappSave(e: React.FormEvent) {
    e.preventDefault();
    setWhatsappSaving(true);
    try {
      const updated = await api.post<WhatsAppSettings>('/admin/whatsapp-settings', {
        enabled: whatsappForm.enabled,
        orderEnabled: whatsappForm.orderEnabled,
        dispatchEnabled: whatsappForm.dispatchEnabled,
        deliveryEnabled: whatsappForm.deliveryEnabled,
        orderTemplateSid: whatsappForm.orderTemplateSid.trim(),
        dispatchTemplateSid: whatsappForm.dispatchTemplateSid.trim(),
        deliveryTemplateSid: whatsappForm.deliveryTemplateSid.trim(),
      });
      setWhatsappConfigured(updated.configured);
      setWhatsappForm({
        enabled: updated.enabled, orderEnabled: updated.orderEnabled,
        dispatchEnabled: updated.dispatchEnabled, deliveryEnabled: updated.deliveryEnabled,
        orderTemplateSid: updated.orderTemplateSid ?? '',
        dispatchTemplateSid: updated.dispatchTemplateSid ?? '',
        deliveryTemplateSid: updated.deliveryTemplateSid ?? '',
      });
      showToast('WhatsApp settings saved.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save WhatsApp settings';
      showToast(msg, 'error');
    } finally {
      setWhatsappSaving(false);
    }
  }

  async function handleIdleSave(e: React.FormEvent) {
    e.preventDefault();
    const freeMin = idleForm.freeMin.trim();
    const ratePerHour = idleForm.ratePerHour.trim();
    if (freeMin && (!Number.isFinite(Number(freeMin)) || Number(freeMin) < 0)) {
      showToast('Free minutes must be a number of 0 or more.', 'error');
      return;
    }
    if (ratePerHour && (!Number.isFinite(Number(ratePerHour)) || Number(ratePerHour) < 0)) {
      showToast('Idle rate must be a number of 0 or more.', 'error');
      return;
    }
    setIdleSaving(true);
    try {
      // Empty string clears the value: freeMin reverts to the default, rate to none.
      const updated = await api.post<{ freeMin: number; ratePerHour: number | null; defaults: { freeMin: number; ratePerHour: number | null } }>(
        '/admin/idle-settings',
        { freeMin, ratePerHour },
      );
      setIdleForm({ freeMin: String(updated.freeMin), ratePerHour: updated.ratePerHour == null ? '' : String(updated.ratePerHour) });
      if (updated.defaults) setIdleDefaults(updated.defaults);
      showToast('Idle charge settings saved.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save idle settings';
      showToast(msg, 'error');
    } finally {
      setIdleSaving(false);
    }
  }

  async function handleFuelSave(e: React.FormEvent) {
    e.preventDefault();
    const nums: Array<[string, string]> = [
      ['Variance threshold', fuelForm.reconVariancePct],
      ['Idle burn rate', fuelForm.idleBurnLph],
      ['Unscheduled stop minutes', fuelForm.unscheduledStopMin],
      ['Route deviation metres', fuelForm.routeDeviationM],
    ];
    for (const [label, val] of nums) {
      const t = val.trim();
      if (t && (!Number.isFinite(Number(t)) || Number(t) < 0)) {
        showToast(`${label} must be a number of 0 or more.`, 'error');
        return;
      }
    }
    const lat = fuelForm.plantLat.trim();
    const lng = fuelForm.plantLng.trim();
    if ((lat === '') !== (lng === '')) {
      showToast('Set both plant latitude and longitude, or leave both blank.', 'error');
      return;
    }
    if (lat && (!Number.isFinite(Number(lat)) || Number(lat) < -90 || Number(lat) > 90)) {
      showToast('Plant latitude must be between -90 and 90.', 'error');
      return;
    }
    if (lng && (!Number.isFinite(Number(lng)) || Number(lng) < -180 || Number(lng) > 180)) {
      showToast('Plant longitude must be between -180 and 180.', 'error');
      return;
    }
    setFuelSaving(true);
    try {
      const updated = await api.post<FuelSettings>('/admin/fuel-settings', {
        reconVariancePct: fuelForm.reconVariancePct.trim(),
        idleBurnLph: fuelForm.idleBurnLph.trim(),
        unscheduledStopMin: fuelForm.unscheduledStopMin.trim(),
        routeDeviationM: fuelForm.routeDeviationM.trim(),
        plantLat: lat,
        plantLng: lng,
      });
      setFuelForm({
        reconVariancePct: String(updated.reconVariancePct),
        idleBurnLph: String(updated.idleBurnLph),
        unscheduledStopMin: String(updated.unscheduledStopMin),
        routeDeviationM: String(updated.routeDeviationM),
        plantLat: updated.plantLat == null ? '' : String(updated.plantLat),
        plantLng: updated.plantLng == null ? '' : String(updated.plantLng),
      });
      if (updated.defaults) setFuelDefaults(updated.defaults);
      showToast('Fuel & alert settings saved.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save fuel settings';
      showToast(msg, 'error');
    } finally {
      setFuelSaving(false);
    }
  }

  async function handleTestEmail() {
    setTestEmailSending(true);
    setTestEmailResult(null);
    try {
      await api.post('/admin/email-test', {});
      setTestEmailResult({ ok: true, message: `Test email sent to ${user?.email}. Check your inbox.` });
      showToast('Test email sent successfully.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send test email';
      setTestEmailResult({ ok: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setTestEmailSending(false);
      setHistoryReload(n => n + 1);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    setSaving(true);
    setSuccess(false);
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password changed successfully.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change password';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await api.delete('/me/account');
      showToast('Your account has been deleted.', 'success');
      logout();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete account';
      setDeleteError(msg);
      setDeleteBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          Account Settings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          Manage your account details and security preferences.
        </p>
      </div>

      {/* Profile card */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: `color-mix(in srgb, ${roleColor} 13%, transparent)`, border: `1.5px solid color-mix(in srgb, ${roleColor} 33%, transparent)`,
            display: 'grid', placeItems: 'center',
            fontSize: 20, fontWeight: 900, color: roleColor,
          }}>
            {user?.name?.[0] || '?'}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{user?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{user?.email}</div>
            {/* Customer and driver accounts don't surface the raw role badge —
                a verified badge (when applicable) replaces it instead. */}
            {hasIdentityRestrictions ? (
              hasVerifiedLegalName && (
                <div style={{
                  display: 'inline-block', marginTop: 5,
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px',
                  color: 'var(--green)', background: 'rgba(34,197,94,.1)',
                  border: '1px solid rgba(34,197,94,.25)', borderRadius: 999, padding: '2px 8px',
                }}>
                  Verified
                </div>
              )
            ) : (
              <div style={{
                display: 'inline-block', marginTop: 5,
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px',
                color: roleColor, background: `color-mix(in srgb, ${roleColor} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${roleColor} 20%, transparent)`, borderRadius: 999, padding: '2px 8px',
              }}>
                {roleLabel}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Identity card — the session/identity details previously shown in the
          on-screen debug popup, now surfaced here read-only. */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'color-mix(in srgb, var(--blue) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--blue) 27%, transparent)',
            display: 'grid', placeItems: 'center',
          }}>
            <ShieldCheck size={15} style={{ color: 'var(--blue)' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Identity &amp; Session</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Your account identifiers for support &amp; troubleshooting</div>
          </div>
        </div>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(120px,auto) 1fr', gap: '9px 14px', fontSize: 13 }}>
          {([
            ['Name', user?.name || '—'],
            // Customer and driver accounts never surface the raw role field.
            ...(hasIdentityRestrictions ? [] : [['Role', roleLabel] as [string, string]]),
            ['Mobile / Email', user?.phone || user?.email || '—'],
            ['User ID', user?.id != null ? String(user.id) : '—'],
            ...(user?.role === 'driver' && user?.linkedDriverId != null ? [['Driver ID', String(user.linkedDriverId)] as [string, string]] : []),
            ...(user?.plantId != null ? [['Plant ID', String(user.plantId)] as [string, string]] : []),
            ...(plantProfile?.name ? [['Assigned Plant', plantProfile.name] as [string, string]] : []),
            ...(user?.truckId != null ? [['Truck ID', user.truckNo ? `${user.truckId} · ${user.truckNo}` : String(user.truckId)] as [string, string]] : []),
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt style={{ color: 'var(--muted)', fontWeight: 600 }}>{k}</dt>
              <dd style={{ margin: 0, color: 'var(--text)', fontWeight: 700, fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Appearance: the theme follows sunrise/sunset automatically — no picker. */}

      {/* Push notifications card */}
      <NotificationsCard />

      {/* Edit profile card */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.25)',
            display: 'grid', placeItems: 'center',
          }}>
            <UserIcon size={15} style={{ color: 'var(--blue)' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Edit Profile</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Update your display name and email address</div>
          </div>
        </div>

        <form onSubmit={handleProfileSave} style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={label}>{hasVerifiedLegalName ? 'Verified Legal Name' : 'Display Name'}</label>
            <input
              type="text"
              value={hasVerifiedLegalName ? (verifiedLegalName ?? '') : profileName}
              onChange={e => setProfileName(e.target.value)}
              placeholder="Your full name"
              style={{ ...inputStyle, padding: '10px 12px', ...(hasVerifiedLegalName ? { opacity: 0.75, cursor: 'not-allowed' } : {}) }}
              autoComplete="name"
              readOnly={hasVerifiedLegalName}
              disabled={hasVerifiedLegalName}
            />
            {hasVerifiedLegalName && (
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6, lineHeight: 1.4 }}>
                Verified identity details can only be changed through identity re-verification.
              </div>
            )}
          </div>
          <div>
            <label style={label}>Email Address</label>
            <input
              type="email"
              value={profileEmail}
              onChange={e => setProfileEmail(e.target.value)}
              placeholder="your@email.com"
              style={{ ...inputStyle, padding: '10px 12px' }}
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            disabled={profileSaving || !profileDirty}
            style={{
              marginTop: 4, padding: '11px 22px', borderRadius: 10,
              background: profileSaving ? 'rgba(56,189,248,.4)' : 'linear-gradient(135deg,var(--blue),#0ea5e9)',
              border: 'none', cursor: (profileSaving || !profileDirty) ? 'not-allowed' : 'pointer',
              color: '#fff', fontWeight: 800, fontSize: 14,
              opacity: !profileDirty ? 0.5 : 1,
              transition: 'opacity .15s',
            }}
          >
            {profileSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Default plant card — customers only */}
      {isClient && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <MapPin size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Default Plant</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Pre-selected when you place a new order</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={label}>Preferred Plant</label>
              <select
                value={prefPlantSelected}
                onChange={e => setPrefPlantSelected(e.target.value)}
                disabled={prefPlantLoading || prefPlantSaving}
                style={{ ...inputStyle, padding: '10px 12px', cursor: prefPlantLoading ? 'wait' : 'pointer' }}
              >
                <option value="">{prefPlantLoading ? 'Loading…' : 'No default plant'}</option>
                {prefPlantDir.map(p => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}{p.city ? ` · ${p.city}` : ''}{p.plantCode ? ` (${p.plantCode})` : ''}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                Choose “No default plant” to clear your selection.
              </div>
              {prefPlantError && (
                <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6 }}>
                  Couldn’t load your plants. Refresh the page to try again.
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handlePreferredPlantSave}
              disabled={prefPlantLoading || prefPlantSaving || prefPlantSelected === (prefPlantId != null ? String(prefPlantId) : '')}
              style={{
                marginTop: 4, padding: '11px 22px', borderRadius: 10,
                background: prefPlantSaving ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
                border: 'none',
                cursor: (prefPlantLoading || prefPlantSaving || prefPlantSelected === (prefPlantId != null ? String(prefPlantId) : '')) ? 'not-allowed' : 'pointer',
                color: '#111827', fontWeight: 800, fontSize: 14,
                opacity: prefPlantSelected === (prefPlantId != null ? String(prefPlantId) : '') ? 0.5 : 1,
                transition: 'opacity .15s',
              }}
            >
              {prefPlantSaving ? 'Saving…' : 'Save Default Plant'}
            </button>
          </div>
        </div>
      )}

      {/* Aadhaar KYC card — customers only */}
      {isClient && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <ShieldCheck size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Aadhaar KYC</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Verify your identity with DigiLocker to unlock a verified badge</div>
            </div>
          </div>

          {kycLoading && !kyc ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>
          ) : (
            <>
              {(() => {
                const status = kyc?.status ?? 'unverified';
                const verified = status === 'verified';
                const pending = status === 'pending' || kycPolling;
                const failed = status === 'failed';
                const chipColor = verified ? '#22c55e' : failed ? '#ef4444' : pending ? '#eab308' : 'var(--muted)';
                // Backend statuses: unverified/pending/verified/failed — presented
                // here as the not-started/pending/verified/rejected states.
                const chipLabel = verified ? 'Verified' : failed ? 'Rejected' : pending ? 'Pending' : 'Not Started';
                return (
                  <>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 16,
                      padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                      background: `color-mix(in srgb, ${chipColor} 14%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${chipColor} 35%, transparent)`,
                      color: chipColor,
                    }}>
                      {verified ? <CheckCircle size={13} /> : failed ? <XCircle size={13} /> : pending ? <RefreshCw size={13} /> : <ShieldCheck size={13} />}
                      KYC Status: {chipLabel}
                    </div>
                    {failed && kyc?.rejectionReason && (
                      <div style={{
                        fontSize: 12, color: 'var(--red)', marginBottom: 14, marginTop: -4,
                        padding: '9px 12px', borderRadius: 10,
                        background: 'color-mix(in srgb, var(--red) 10%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--red) 28%, transparent)',
                      }}>
                        Reason: {kyc.rejectionReason}
                      </div>
                    )}
                  </>
                );
              })()}

              {kyc?.status === 'verified' ? (
                <div style={{ display: 'grid', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                  {kyc.fullName && (
                    <div><span style={{ color: 'var(--muted)' }}>Name: </span><strong>{kyc.fullName}</strong></div>
                  )}
                  {kyc.maskedAadhaar && (
                    <div><span style={{ color: 'var(--muted)' }}>Aadhaar: </span><strong>{kyc.maskedAadhaar}</strong></div>
                  )}
                  {kyc.verifiedAt && (
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Verified on {new Date(kyc.verifiedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
                    You’ll be taken to DigiLocker to share your Aadhaar. We only store a
                    <strong style={{ color: 'var(--text)' }}> masked Aadhaar number</strong> (last 4 digits) and your name — never the full number.
                  </div>

                  {kyc && !kyc.configured && (
                    <div style={{
                      fontSize: 12, color: '#eab308', marginBottom: 14, padding: '10px 12px', borderRadius: 10,
                      background: 'color-mix(in srgb, #eab308 12%, transparent)', border: '1px solid color-mix(in srgb, #eab308 30%, transparent)',
                    }}>
                      KYC verification isn’t available yet. Please check back later.
                    </div>
                  )}

                  {kycError && (
                    <div style={{
                      fontSize: 12, color: 'var(--red)', marginBottom: 14, padding: '10px 12px', borderRadius: 10,
                      background: 'color-mix(in srgb, #ef4444 12%, transparent)', border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
                    }}>
                      {kycError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleKycStart}
                    disabled={kycStarting || kycPolling || (kyc != null && !kyc.configured)}
                    style={{
                      padding: '11px 22px', borderRadius: 10,
                      background: (kycStarting || kycPolling || (kyc != null && !kyc.configured))
                        ? 'color-mix(in srgb, var(--gold) 40%, transparent)'
                        : 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
                      border: 'none',
                      cursor: (kycStarting || kycPolling || (kyc != null && !kyc.configured)) ? 'not-allowed' : 'pointer',
                      color: '#111827', fontWeight: 800, fontSize: 14,
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      transition: 'opacity .15s',
                    }}
                  >
                    {kycPolling ? (<><RefreshCw size={15} /> Waiting for verification…</>)
                      : kycStarting ? 'Starting…'
                      : kyc?.status === 'failed' ? 'Retry verification'
                      : 'Verify with DigiLocker'}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Plant identity card — only for an account bound to a plant (owner) */}
      {plantProfile && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <UserIcon size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Plant Identity</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                Branding printed on your challans &amp; delivery receipts
                {plantProfile.plantCode ? ` · ${plantProfile.plantCode}` : ''}
              </div>
            </div>
          </div>

          <form onSubmit={handlePlantSave} style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={label}>Plant Name</label>
              <input type="text" value={plantForm.name} onChange={e => setPlantForm(f => ({ ...f, name: e.target.value }))} placeholder="Display name" style={{ ...inputStyle, padding: '10px 12px' }} />
            </div>
            <div>
              <label style={label}>Legal / Billing Name</label>
              <input type="text" value={plantForm.legalName} onChange={e => setPlantForm(f => ({ ...f, legalName: e.target.value }))} placeholder="Registered company name" style={{ ...inputStyle, padding: '10px 12px' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={label}>GST Number</label>
                <input type="text" value={plantForm.gstNo} onChange={e => setPlantForm(f => ({ ...f, gstNo: e.target.value }))} placeholder="e.g. 27AAACA1234B1Z5" style={{ ...inputStyle, padding: '10px 12px' }} />
              </div>
              <div>
                <label style={label}>Contact Number</label>
                <input type="text" value={plantForm.contactNumber} onChange={e => setPlantForm(f => ({ ...f, contactNumber: e.target.value }))} placeholder="Phone" style={{ ...inputStyle, padding: '10px 12px' }} />
              </div>
            </div>
            <div>
              <label style={label}>Email</label>
              <input type="email" value={plantForm.email} onChange={e => setPlantForm(f => ({ ...f, email: e.target.value }))} placeholder="billing@plant.com" style={{ ...inputStyle, padding: '10px 12px' }} />
            </div>
            <div>
              <label style={label}>Address</label>
              <input type="text" value={plantForm.address} onChange={e => setPlantForm(f => ({ ...f, address: e.target.value }))} placeholder="Street / area" style={{ ...inputStyle, padding: '10px 12px' }} />
            </div>
            <div>
              <label style={label}>City</label>
              <input type="text" value={plantForm.city} onChange={e => setPlantForm(f => ({ ...f, city: e.target.value }))} placeholder="City" style={{ ...inputStyle, padding: '10px 12px' }} />
            </div>

            <button
              type="submit"
              disabled={plantSaving}
              style={{
                marginTop: 4, padding: '11px 22px', borderRadius: 10,
                background: plantSaving ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
                border: 'none', cursor: plantSaving ? 'not-allowed' : 'pointer',
                color: '#111827', fontWeight: 800, fontSize: 14,
              }}
            >
              {plantSaving ? 'Saving…' : 'Save Plant Details'}
            </button>
          </form>
        </div>
      )}

      {/* SMTP test card — admins only */}
      {isAdmin && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.25)',
              display: 'grid', placeItems: 'center',
            }}>
              <Mail size={15} style={{ color: 'var(--green)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>SMTP Configuration</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Edit your mail server settings and run a connection test</div>
            </div>
          </div>

          {smtpLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>Loading settings…</div>
          ) : (
            <form onSubmit={handleSmtpSave} style={{ marginBottom: 18 }}>
              {smtpSettings && (
                <div style={{
                  marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                  color: smtpSettings.configured ? 'var(--green)' : 'var(--gold)',
                  background: smtpSettings.configured ? 'rgba(34,197,94,.12)' : 'rgba(23,138,110,.12)',
                  border: `1px solid ${smtpSettings.configured ? 'rgba(34,197,94,.3)' : 'rgba(23,138,110,.3)'}`,
                }}>
                  {smtpSettings.configured ? 'Configured' : 'Incomplete (password missing)'}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <SmtpTextField
                  label="Host"
                  value={smtpForm.host}
                  onChange={v => setSmtpForm(f => ({ ...f, host: v }))}
                  placeholder="smtp.example.com"
                />
                <SmtpTextField
                  label="Port"
                  value={smtpForm.port}
                  onChange={v => setSmtpForm(f => ({ ...f, port: v }))}
                  placeholder="587"
                />
                <SmtpTextField
                  label="Username"
                  value={smtpForm.user}
                  onChange={v => setSmtpForm(f => ({ ...f, user: v }))}
                  placeholder={smtpSettings?.user ? `${smtpSettings.user} — blank keeps` : 'smtp username'}
                />
                <SmtpTextField
                  label="From Address"
                  value={smtpForm.from}
                  onChange={v => setSmtpForm(f => ({ ...f, from: v }))}
                  placeholder={smtpSettings?.from ? `${smtpSettings.from} — blank keeps` : 'noreply@example.com'}
                />
                <div style={{ gridColumn: '1 / -1' }}>
                  <SmtpTextField
                    label="Password"
                    type="password"
                    value={smtpForm.pass}
                    onChange={v => setSmtpForm(f => ({ ...f, pass: v }))}
                    placeholder={smtpSettings?.configured ? 'Leave blank to keep current password' : 'smtp password'}
                  />
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                Values are saved to the database and survive restarts. Host and port are saved
                as entered — clear them to fall back to the matching environment variable.
                Username, From and Password update only when you fill them in; leave them blank
                to keep the current values.
              </div>

              {verifyResult && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14,
                  padding: '10px 14px', borderRadius: 10,
                  background: verifyResult.ok ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
                  border: `1px solid ${verifyResult.ok ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}`,
                  color: verifyResult.ok ? 'var(--green)' : 'var(--red)',
                  fontSize: 13, fontWeight: 600,
                }}>
                  {verifyResult.ok
                    ? <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    : <XCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />}
                  {verifyResult.message}
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
                <button
                  type="submit"
                  disabled={smtpSaving}
                  style={{
                    padding: '10px 22px', borderRadius: 10,
                    background: smtpSaving ? 'rgba(34,197,94,.35)' : 'linear-gradient(135deg,var(--green),#16a34a)',
                    border: 'none', cursor: smtpSaving ? 'not-allowed' : 'pointer',
                    color: '#fff', fontWeight: 800, fontSize: 14,
                    transition: 'opacity .15s',
                  }}
                >
                  {smtpSaving ? 'Saving…' : 'Save SMTP settings'}
                </button>
                <button
                  type="button"
                  onClick={handleVerifyConnection}
                  disabled={smtpVerifying}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '10px 22px', borderRadius: 10,
                    background: 'rgba(56,189,248,.12)',
                    border: '1px solid rgba(56,189,248,.4)',
                    cursor: smtpVerifying ? 'not-allowed' : 'pointer',
                    color: 'var(--blue)', fontWeight: 700, fontSize: 14,
                    transition: 'opacity .15s',
                  }}
                >
                  <PlugZap size={15} />
                  {smtpVerifying ? 'Testing…' : 'Test connection'}
                </button>
              </div>
            </form>
          )}

          {testEmailResult && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16,
              padding: '10px 14px', borderRadius: 10,
              background: testEmailResult.ok ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
              border: `1px solid ${testEmailResult.ok ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}`,
              color: testEmailResult.ok ? 'var(--green)' : 'var(--red)',
              fontSize: 13, fontWeight: 600,
            }}>
              <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              {testEmailResult.message}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testEmailSending}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 20px', borderRadius: 10,
                background: testEmailSending ? 'rgba(34,197,94,.35)' : 'linear-gradient(135deg,var(--green),#16a34a)',
                border: 'none', cursor: testEmailSending ? 'not-allowed' : 'pointer',
                color: '#fff', fontWeight: 700, fontSize: 14,
                transition: 'opacity .15s',
              }}
            >
              <Send size={14} />
              {testEmailSending ? 'Sending…' : 'Send test email'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Sends to <strong style={{ color: 'var(--text)' }}>{user?.email}</strong>
            </span>
          </div>

          {/* Test history */}
          <div style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <History size={14} color="#9fb0c7" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                Test History
              </span>
            </div>

            {historyLoading && testHistory.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>
            ) : testHistory.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>No test attempts recorded yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {testHistory.map(log => {
                  const ok = log.status === 'success';
                  const kindLabel = log.action === 'smtp_verify' ? 'Connection test' : 'Test email';
                  return (
                    <div key={log.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px', borderRadius: 10,
                      background: 'var(--chip-bg)',
                      border: '1px solid var(--line)',
                    }}>
                      {ok
                        ? <CheckCircle size={15} color="#22c55e" style={{ flexShrink: 0, marginTop: 1 }} />
                        : <XCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px',
                            color: 'var(--muted)', padding: '2px 7px', borderRadius: 6,
                            background: 'var(--chip-bg)', border: '1px solid var(--line)',
                          }}>
                            {kindLabel}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: ok ? '#22c55e' : '#ef4444' }}>
                            {ok ? 'Success' : 'Failed'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {log.detail && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, wordBreak: 'break-word' }}>
                            {log.detail}
                          </div>
                        )}
                        {log.actorName && (
                          <div style={{ fontSize: 11, color: '#6b7d96', marginTop: 2 }}>
                            by {log.actorName}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Help Assistant card — admins only */}
      {isAdmin && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <MessageCircle size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>AI Help Assistant</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>The floating in-app assistant. It only ever answers from each user's own plant-scoped data.</div>
            </div>
          </div>

          {aiLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading settings…</div>
          ) : (
            <form onSubmit={handleAiSave}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
                <input
                  type="checkbox"
                  checked={aiForm.enabled}
                  onChange={e => setAiForm(f => ({ ...f, enabled: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                  Enable the AI help assistant for all users
                </span>
              </label>

              <div style={{ marginBottom: 14 }}>
                <label style={label}>Greeting message</label>
                <textarea
                  value={aiForm.greeting}
                  onChange={e => setAiForm(f => ({ ...f, greeting: e.target.value }))}
                  placeholder={aiDefaults.greeting}
                  rows={2}
                  style={{
                    width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '9px 12px', borderRadius: 10, fontSize: 13,
                    background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', fontFamily: 'inherit', resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label style={label}>Persona &amp; guardrails</label>
                <textarea
                  value={aiForm.persona}
                  onChange={e => setAiForm(f => ({ ...f, persona: e.target.value }))}
                  placeholder={aiDefaults.persona}
                  rows={4}
                  style={{
                    width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '9px 12px', borderRadius: 10, fontSize: 13,
                    background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', fontFamily: 'inherit', resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                Leave a field blank to use the built-in default. The persona shapes the assistant's tone; data scoping
                and secret protection are enforced by the server and cannot be overridden here.
              </div>

              <button
                type="submit"
                disabled={aiSaving}
                style={{
                  marginTop: 14, padding: '10px 22px', borderRadius: 10,
                  background: aiSaving ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'linear-gradient(135deg,var(--gold),var(--gold-dark))',
                  border: 'none', cursor: aiSaving ? 'not-allowed' : 'pointer',
                  color: '#111', fontWeight: 800, fontSize: 14, transition: 'opacity .15s',
                }}
              >
                {aiSaving ? 'Saving…' : 'Save assistant settings'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Delivery variance tolerance card — admins only */}
      {isAdmin && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <Target size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Delivery Variance Tolerance</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>How far a delivery can deviate from the planned quantity before it's flagged</div>
            </div>
          </div>

          {varianceLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading settings…</div>
          ) : (
            <form onSubmit={handleVarianceSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <SmtpTextField
                  label="Absolute (m³)"
                  type="number"
                  value={varianceForm.abs}
                  onChange={v => setVarianceForm(f => ({ ...f, abs: v }))}
                  placeholder={String(varianceDefaults.abs)}
                />
                <SmtpTextField
                  label="Percentage (%)"
                  type="number"
                  value={varianceForm.pct}
                  onChange={v => setVarianceForm(f => ({ ...f, pct: v }))}
                  placeholder={String(varianceDefaults.pct)}
                />
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                A delivery is treated as <strong style={{ color: 'var(--text)' }}>on target</strong> when its
                shortfall or excess is within the larger of these two bands. The percentage is taken against the
                planned load, so a 5% band tolerates ±0.5 m³ on a 10 m³ load. Set percentage to 0 to use the
                absolute band only. Clear a field to fall back to the default
                ({varianceDefaults.abs} m³ / {varianceDefaults.pct}%).
              </div>

              <button
                type="submit"
                disabled={varianceSaving}
                style={{
                  marginTop: 14, padding: '10px 22px', borderRadius: 10,
                  background: varianceSaving ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'linear-gradient(135deg,var(--gold),var(--gold-dark))',
                  border: 'none', cursor: varianceSaving ? 'not-allowed' : 'pointer',
                  color: '#111', fontWeight: 800, fontSize: 14,
                  transition: 'opacity .15s',
                }}
              >
                {varianceSaving ? 'Saving…' : 'Save tolerance'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Platform commission card — admins only */}
      {isAdmin && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <Percent size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Platform Commission</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>The default percentage the marketplace takes on each order</div>
            </div>
          </div>

          {commissionLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading settings…</div>
          ) : (
            <form onSubmit={handleCommissionSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <SmtpTextField
                  label="Commission (%)"
                  type="number"
                  value={commissionForm}
                  onChange={v => setCommissionForm(v)}
                  placeholder={String(commissionDefault)}
                />
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                Applied to every order platform-wide. Individual plants can override this from their
                plant editor. Clear the field to fall back to the default ({commissionDefault}%).
              </div>

              <button
                type="submit"
                disabled={commissionSaving}
                style={{
                  marginTop: 14, padding: '10px 22px', borderRadius: 10,
                  background: commissionSaving ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'linear-gradient(135deg,var(--gold),var(--gold-dark))',
                  border: 'none', cursor: commissionSaving ? 'not-allowed' : 'pointer',
                  color: '#111', fontWeight: 800, fontSize: 14,
                  transition: 'opacity .15s',
                }}
              >
                {commissionSaving ? 'Saving…' : 'Save commission'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Storage usage — platform staff only */}
      {isPlatformStaff && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <Inbox size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Storage Usage</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Files uploaded across all plants (proof photos & fuel bills)</div>
            </div>
          </div>

          {storageLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading usage…</div>
          ) : !storageUsage || !storageUsage.byPlant || storageUsage.byPlant.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>No files registered yet.</div>
          ) : (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
                {storageUsage.totalFiles} file{storageUsage.totalFiles === 1 ? '' : 's'} total
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {storageUsage.byPlant.map((u, i) => (
                  <div key={`${u.plantId}-${u.fileType}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--panel, color-mix(in srgb, var(--gold) 5%, transparent))', border: '1px solid var(--line, color-mix(in srgb, var(--gold) 18%, transparent))' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{u.plantName}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold)', background: 'color-mix(in srgb, var(--gold) 13%, transparent)', borderRadius: 6, padding: '2px 7px' }}>
                      {u.fileType === 'proof_photo' ? 'Proof photo' : u.fileType === 'fuel_bill' ? 'Fuel bill' : u.fileType}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 'auto', fontWeight: 700 }}>{u.fileCount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Role-permission editor — platform staff only (cross-tenant policy) */}
      {isPlatformStaff && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <Lock size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Role Permissions</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Which app pages each role can open (one path per line)</div>
            </div>
          </div>

          {rolePermLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading permissions…</div>
          ) : (
            <form onSubmit={handleRolePermsSave}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 14 }}>
                {Object.keys(ROLE_ALLOWED_PATHS).map(role => (
                  <div key={role}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text)', marginBottom: 6, textTransform: 'capitalize' }}>
                      {role.replace(/_/g, ' ')}
                    </label>
                    <textarea
                      value={rolePermForm[role] ?? ''}
                      onChange={e => setRolePermForm(prev => ({ ...prev, [role]: e.target.value }))}
                      rows={6}
                      spellCheck={false}
                      style={{
                        width: '100%', boxSizing: 'border-box', resize: 'vertical',
                        padding: '8px 10px', borderRadius: 8, fontSize: 12, fontFamily: 'monospace',
                        background: 'var(--panel, color-mix(in srgb, var(--gold) 5%, transparent))',
                        border: '1px solid var(--line, color-mix(in srgb, var(--gold) 18%, transparent))',
                        color: 'var(--text)',
                      }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                Edit the allowed paths per role. A role left exactly matching its built-in default is not overridden
                (so it keeps tracking future updates). Changes apply to each user on their next page load.
              </div>

              <button
                type="submit"
                disabled={rolePermSaving}
                style={{
                  marginTop: 14, padding: '10px 22px', borderRadius: 10,
                  background: rolePermSaving ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'linear-gradient(135deg,var(--gold),var(--gold-dark))',
                  border: 'none', cursor: rolePermSaving ? 'not-allowed' : 'pointer',
                  color: '#111', fontWeight: 800, fontSize: 14, transition: 'opacity .15s',
                }}
              >
                {rolePermSaving ? 'Saving…' : 'Save permissions'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Staff login security (2FA) card — platform staff only (cross-tenant policy) */}
      {isPlatformStaff && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <ShieldCheck size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Staff Login Security (2FA)</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Turn the one-time code on or off per staff role</div>
            </div>
          </div>

          {staff2faLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading settings…</div>
          ) : (
            <form onSubmit={handleStaff2faSave}>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 14 }}>
                Ticked roles have two-factor <b style={{ color: 'var(--text)' }}>OFF</b> — they can sign in with
                email + password only. Unticked roles keep the one-time code requirement. The one-time-code
                option always keeps working as a backup, and a staff member needs a password set
                (via their invite or “Forgot password”) to use password sign-in. Your own Super Admin
                two-factor can never be switched off.
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', marginBottom: 16 }}>
                {STAFF_2FA_ROLES.map(role => {
                  const checked = staff2faExempt.includes(role);
                  return (
                    <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => setStaff2faExempt(prev =>
                          e.target.checked ? [...prev, role] : prev.filter(r => r !== role),
                        )}
                        style={{ width: 15, height: 15, accentColor: 'var(--gold)', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{STAFF_2FA_ROLE_LABEL[role]}</span>
                    </label>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  disabled={staff2faSaving}
                  style={{
                    padding: '10px 22px', borderRadius: 10,
                    background: staff2faSaving ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'linear-gradient(135deg,var(--gold),var(--gold-dark))',
                    border: 'none', cursor: staff2faSaving ? 'not-allowed' : 'pointer',
                    color: '#111', fontWeight: 800, fontSize: 14, transition: 'opacity .15s',
                  }}
                >
                  {staff2faSaving ? 'Saving…' : 'Save login security'}
                </button>
                {staff2faExempt.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStaff2faExempt([])}
                    disabled={staff2faSaving}
                    style={{
                      padding: '10px 16px', borderRadius: 10, background: 'transparent',
                      border: '1px solid color-mix(in srgb, var(--gold) 35%, transparent)',
                      color: 'var(--gold)', fontWeight: 700, fontSize: 13,
                      cursor: staff2faSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    2FA on for all roles
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {/* App version card — platform staff only (client-visible, cross-tenant) */}
      {isPlatformStaff && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <PlugZap size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>App Version</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>A version label surfaced to every client</div>
            </div>
          </div>

          {appVersionLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading version…</div>
          ) : (
            <form onSubmit={handleAppVersionSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <SmtpTextField
                  label="Version"
                  value={appVersionForm}
                  onChange={v => setAppVersionForm(v)}
                  placeholder="e.g. 2.4.0"
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                Clear the field to hide the version. It loads from the public app config on every client.
              </div>
              <button
                type="submit"
                disabled={appVersionSaving}
                style={{
                  marginTop: 14, padding: '10px 22px', borderRadius: 10,
                  background: appVersionSaving ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'linear-gradient(135deg,var(--gold),var(--gold-dark))',
                  border: 'none', cursor: appVersionSaving ? 'not-allowed' : 'pointer',
                  color: '#111', fontWeight: 800, fontSize: 14, transition: 'opacity .15s',
                }}
              >
                {appVersionSaving ? 'Saving…' : 'Save version'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Social Appearance card — platform staff only (client-visible, cross-tenant) */}
      {isPlatformStaff && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <Share2 size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Social Appearance</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Links behind the social icons on the landing &amp; public pages</div>
            </div>
          </div>

          {socialLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading links…</div>
          ) : (
            <form onSubmit={handleSocialSave}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 12 }}>
                <SmtpTextField
                  label="YouTube"
                  value={socialForm.youtube}
                  onChange={v => setSocialForm(f => ({ ...f, youtube: v }))}
                  placeholder="https://youtube.com/@yourchannel"
                />
                <SmtpTextField
                  label="Instagram"
                  value={socialForm.instagram}
                  onChange={v => setSocialForm(f => ({ ...f, instagram: v }))}
                  placeholder="https://www.instagram.com/yourprofile"
                />
                <SmtpTextField
                  label="Facebook"
                  value={socialForm.facebook}
                  onChange={v => setSocialForm(f => ({ ...f, facebook: v }))}
                  placeholder="https://www.facebook.com/yourpage"
                />
                <SmtpTextField
                  label="WhatsApp"
                  value={socialForm.whatsapp}
                  onChange={v => setSocialForm(f => ({ ...f, whatsapp: v }))}
                  placeholder="https://wa.me/yournumber"
                />
                <SmtpTextField
                  label="Google Play (app link)"
                  value={socialForm.playStore}
                  onChange={v => setSocialForm(f => ({ ...f, playStore: v }))}
                  placeholder="https://play.google.com/store/apps/details?id=…"
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                Each link must be a full https:// URL. Leave Google Play empty until the app is published — its badge shows as "coming soon" meanwhile.
              </div>
              <button
                type="submit"
                disabled={socialSaving}
                style={{
                  marginTop: 14, padding: '10px 22px', borderRadius: 10,
                  background: socialSaving ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'linear-gradient(135deg,var(--gold),var(--gold-dark))',
                  border: 'none', cursor: socialSaving ? 'not-allowed' : 'pointer',
                  color: '#111', fontWeight: 800, fontSize: 14, transition: 'opacity .15s',
                }}
              >
                {socialSaving ? 'Saving…' : 'Save social links'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Full database export — authority only */}
      {user?.role === 'authority' && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <History size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Database Export</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Download a full JSON backup of the core tables</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
            Exports business data (clients, orders, challans, plants, files, audit logs and more). User password
            hashes and auth secrets are excluded. Authority access only.
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            style={{
              padding: '10px 22px', borderRadius: 10,
              background: exporting ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'linear-gradient(135deg,var(--gold),var(--gold-dark))',
              border: 'none', cursor: exporting ? 'not-allowed' : 'pointer',
              color: '#111', fontWeight: 800, fontSize: 14, transition: 'opacity .15s',
            }}
          >
            {exporting ? 'Exporting…' : 'Download export'}
          </button>
        </div>
      )}

      {/* New plant-request notification card — admins only */}
      {isAdmin && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <Mail size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>New Plant-Request Notifications</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Who gets emailed when a customer requests a new plant onboarding</div>
            </div>
          </div>

          {inviteNotifyLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading settings…</div>
          ) : (
            <form onSubmit={handleInviteNotifySave}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
                <input
                  type="checkbox"
                  checked={inviteNotifyForm.emailEnabled}
                  onChange={e => setInviteNotifyForm(f => ({ ...f, emailEnabled: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                  Send an email when a new plant is requested
                </span>
              </label>

              <div style={{ marginBottom: 16 }}>
                <label style={label}>Notify these staff roles</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', marginTop: 4 }}>
                  {INVITE_NOTIFY_ROLES.map(role => {
                    const checked = inviteNotifyForm.roles.includes(role);
                    return (
                      <label
                        key={role}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => setInviteNotifyForm(f => ({
                            ...f,
                            roles: e.target.checked
                              ? [...f.roles, role]
                              : f.roles.filter(r => r !== role),
                          }))}
                          style={{ width: 15, height: 15, accentColor: 'var(--gold)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 13, color: 'var(--text)' }}>{ROLE_LABEL[role]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={label} htmlFor="invite-recipients">Extra recipients (optional)</label>
                <textarea
                  id="invite-recipients"
                  value={inviteNotifyForm.recipients}
                  onChange={e => setInviteNotifyForm(f => ({ ...f, recipients: e.target.value }))}
                  placeholder="e.g. onboarding@yourcompany.com"
                  disabled={!inviteNotifyForm.emailEnabled}
                  rows={2}
                  style={{
                    ...inputStyle,
                    padding: '10px 12px',
                    resize: 'vertical',
                    opacity: inviteNotifyForm.emailEnabled ? 1 : 0.5,
                  }}
                />
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                Every active user in a checked role is emailed (and gets the in-app alert), so the audience stays
                correct as staff come and go. Add any extra addresses above (comma or newline separated) for a
                shared inbox or an outside mailbox — they're notified <strong style={{ color: 'var(--text)' }}>in addition</strong> to
                the chosen roles. With no roles checked, the in-app alert still goes to admins.
              </div>

              <button
                type="submit"
                disabled={inviteNotifySaving}
                style={{
                  marginTop: 14, padding: '10px 22px', borderRadius: 10,
                  background: inviteNotifySaving ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'linear-gradient(135deg,var(--gold),var(--gold-dark))',
                  border: 'none', cursor: inviteNotifySaving ? 'not-allowed' : 'pointer',
                  color: '#111', fontWeight: 800, fontSize: 14,
                  transition: 'opacity .15s',
                }}
              >
                {inviteNotifySaving ? 'Saving…' : 'Save notifications'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Aadhaar KYC aggregator settings — platform staff only */}
      {isPlatformStaff && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <ShieldCheck size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Aadhaar KYC (DigiLocker)</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Aggregator credentials for customer identity verification</div>
            </div>
          </div>

          {kycCfgLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading settings…</div>
          ) : (
            <form onSubmit={handleKycSettingsSave}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 16,
                padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                background: kycCfg?.configured ? 'color-mix(in srgb, #22c55e 14%, transparent)' : 'color-mix(in srgb, #ef4444 14%, transparent)',
                border: `1px solid ${kycCfg?.configured ? 'color-mix(in srgb, #22c55e 35%, transparent)' : 'color-mix(in srgb, #ef4444 35%, transparent)'}`,
                color: kycCfg?.configured ? '#22c55e' : '#ef4444',
              }}>
                {kycCfg?.configured ? <CheckCircle size={13} /> : <XCircle size={13} />}
                {kycCfg?.configured ? 'KYC provider connected' : 'KYC provider not configured'}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 18 }}>
                <input
                  type="checkbox"
                  checked={kycForm.enabled}
                  onChange={e => setKycForm(f => ({ ...f, enabled: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                  Allow customers to verify their Aadhaar
                </span>
              </label>

              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label style={label}>Provider</label>
                  <select
                    value={kycForm.provider}
                    onChange={e => setKycForm(f => ({ ...f, provider: e.target.value }))}
                    style={{ ...inputStyle, padding: '10px 12px', cursor: 'pointer' }}
                  >
                    <option value="sandbox">Sandbox (sandbox.co.in)</option>
                  </select>
                </div>

                <div>
                  <label style={label}>API Key</label>
                  <input
                    type="text"
                    value={kycForm.apiKey}
                    onChange={e => setKycForm(f => ({ ...f, apiKey: e.target.value }))}
                    placeholder={kycCfg?.hasApiKey ? '•••••••• (saved — leave blank to keep)' : 'Enter aggregator API key'}
                    autoComplete="off"
                    style={{ ...inputStyle, padding: '10px 12px' }}
                  />
                </div>

                <div>
                  <label style={label}>API Secret</label>
                  <input
                    type="password"
                    value={kycForm.apiSecret}
                    onChange={e => setKycForm(f => ({ ...f, apiSecret: e.target.value }))}
                    placeholder={kycCfg?.hasApiSecret ? '•••••••• (saved — leave blank to keep)' : 'Enter aggregator API secret'}
                    autoComplete="off"
                    style={{ ...inputStyle, padding: '10px 12px' }}
                  />
                </div>

                <div>
                  <label style={label}>Base URL <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
                  <input
                    type="text"
                    value={kycForm.baseUrl}
                    onChange={e => setKycForm(f => ({ ...f, baseUrl: e.target.value }))}
                    placeholder="https://api.sandbox.co.in"
                    autoComplete="off"
                    style={{ ...inputStyle, padding: '10px 12px' }}
                  />
                </div>

                <div>
                  <label style={label}>API Version <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
                  <input
                    type="text"
                    value={kycForm.apiVersion}
                    onChange={e => setKycForm(f => ({ ...f, apiVersion: e.target.value }))}
                    placeholder="e.g. 1.0"
                    autoComplete="off"
                    style={{ ...inputStyle, padding: '10px 12px' }}
                  />
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 14, lineHeight: 1.5 }}>
                Credentials are stored securely and never returned to the browser. Customers can only verify when a
                provider is connected and KYC is enabled — otherwise the verify action fails safely and never marks
                anyone as verified.
              </div>

              <button
                type="submit"
                disabled={kycCfgSaving}
                style={{
                  marginTop: 16, padding: '10px 22px', borderRadius: 10,
                  background: kycCfgSaving ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'linear-gradient(135deg,var(--gold),var(--gold-dark))',
                  border: 'none', cursor: kycCfgSaving ? 'not-allowed' : 'pointer',
                  color: '#111', fontWeight: 800, fontSize: 14,
                  transition: 'opacity .15s',
                }}
              >
                {kycCfgSaving ? 'Saving…' : 'Save KYC settings'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* WhatsApp order-automation card — admins only */}
      {isAdmin && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <MessageCircle size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>WhatsApp Order Notifications</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Send customers order, dispatch &amp; delivery updates over WhatsApp</div>
            </div>
          </div>

          {whatsappLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading settings…</div>
          ) : (
            <form onSubmit={handleWhatsappSave}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 16,
                padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                background: whatsappConfigured ? 'color-mix(in srgb, #22c55e 14%, transparent)' : 'color-mix(in srgb, #ef4444 14%, transparent)',
                border: `1px solid ${whatsappConfigured ? 'color-mix(in srgb, #22c55e 35%, transparent)' : 'color-mix(in srgb, #ef4444 35%, transparent)'}`,
                color: whatsappConfigured ? '#22c55e' : '#ef4444',
              }}>
                {whatsappConfigured ? <CheckCircle size={13} /> : <XCircle size={13} />}
                {whatsappConfigured ? 'WhatsApp sender connected' : 'WhatsApp sender not configured'}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
                <input
                  type="checkbox"
                  checked={whatsappForm.enabled}
                  onChange={e => setWhatsappForm(f => ({ ...f, enabled: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                  Send WhatsApp notifications to customers
                </span>
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, opacity: whatsappForm.enabled ? 1 : 0.5 }}>
                {([
                  { key: 'order', toggle: 'orderEnabled', sid: 'orderTemplateSid', title: 'Order confirmation', desc: 'Sent when a customer places an order' },
                  { key: 'dispatch', toggle: 'dispatchEnabled', sid: 'dispatchTemplateSid', title: 'Dispatch update', desc: 'Sent when a challan leaves the plant' },
                  { key: 'delivery', toggle: 'deliveryEnabled', sid: 'deliveryTemplateSid', title: 'Delivery confirmation', desc: 'Sent when the delivery is completed' },
                ] as const).map(evt => (
                  <div key={evt.key}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={whatsappForm[evt.toggle]}
                        disabled={!whatsappForm.enabled}
                        onChange={e => setWhatsappForm(f => ({ ...f, [evt.toggle]: e.target.checked }))}
                        style={{ width: 15, height: 15, accentColor: 'var(--gold)', cursor: 'pointer' }}
                      />
                      <span>
                        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{evt.title}</span>
                        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{evt.desc}</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      value={whatsappForm[evt.sid]}
                      onChange={e => setWhatsappForm(f => ({ ...f, [evt.sid]: e.target.value }))}
                      placeholder="Meta template name (e.g. order_placed)"
                      disabled={!whatsappForm.enabled || !whatsappForm[evt.toggle]}
                      autoComplete="off"
                      style={{
                        ...inputStyle, padding: '10px 12px',
                        opacity: whatsappForm.enabled && whatsappForm[evt.toggle] ? 1 : 0.5,
                      }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 14, lineHeight: 1.5 }}>
                Enter the <strong style={{ color: 'var(--text)' }}>approved Meta template name</strong> for each event
                (created &amp; approved in your WhatsApp Manager). A message only sends when notifications are on, the event is
                enabled, a template name is set, and a WhatsApp sender is connected. Delivery is best-effort and never
                blocks the order.
              </div>

              <button
                type="submit"
                disabled={whatsappSaving}
                style={{
                  marginTop: 16, padding: '10px 22px', borderRadius: 10,
                  background: whatsappSaving ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'linear-gradient(135deg,var(--gold),var(--gold-dark))',
                  border: 'none', cursor: whatsappSaving ? 'not-allowed' : 'pointer',
                  color: '#111', fontWeight: 800, fontSize: 14,
                  transition: 'opacity .15s',
                }}
              >
                {whatsappSaving ? 'Saving…' : 'Save WhatsApp settings'}
              </button>
            </form>
          )}

          {/* Pending-retry queue — transient failures waiting to re-send */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Messages waiting to retry</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  Customer updates whose send failed temporarily and will be re-sent automatically
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRetriesReload(n => n + 1)}
                disabled={retriesLoading || retryActingId !== null}
                title="Refresh"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', borderRadius: 9,
                  background: 'var(--chip-bg)', border: '1px solid var(--line)',
                  cursor: (retriesLoading || retryActingId !== null) ? 'not-allowed' : 'pointer',
                  color: 'var(--muted)', fontWeight: 700, fontSize: 12,
                }}
              >
                <RefreshCw size={13} style={{ animation: retriesLoading ? 'spin 1s linear infinite' : undefined }} />
                Refresh
              </button>
            </div>

            {retries.length === 0 ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '14px 16px', borderRadius: 10,
                background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)',
                color: 'var(--muted)', fontSize: 13, fontWeight: 600,
              }}>
                <CheckCircle size={15} style={{ color: 'var(--green)', flexShrink: 0 }} />
                {retriesLoading ? 'Checking the retry queue…' : 'No messages are waiting to retry.'}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {retries.map(r => {
                  const acting = retryActingId === r.id;
                  const due = new Date(r.nextAttemptAt).getTime();
                  const dueLabel = due <= now
                    ? 'due now'
                    : `next try in ${formatRemaining(due - now)}`;
                  return (
                    <div key={r.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 12,
                      background: 'rgba(23,138,110,.06)', border: '1px solid rgba(23,138,110,.18)',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                          {EVENT_LABEL[r.event ?? ''] ?? 'WhatsApp message'} · {r.toPhone}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Attempt {r.attempts} · {dueLabel}
                          {r.lastError ? ` · ${r.lastError}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleForceRetry(r.id)}
                        disabled={retryActingId !== null}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                          padding: '7px 12px', borderRadius: 9,
                          background: acting ? 'rgba(34,197,94,.35)' : 'linear-gradient(135deg,var(--green),#16a34a)',
                          border: 'none', cursor: retryActingId !== null ? 'not-allowed' : 'pointer',
                          color: '#fff', fontWeight: 700, fontSize: 12,
                        }}
                      >
                        <Send size={12} />
                        Retry now
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancelRetry(r.id)}
                        disabled={retryActingId !== null}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                          padding: '7px 12px', borderRadius: 9,
                          background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)',
                          cursor: retryActingId !== null ? 'not-allowed' : 'pointer',
                          color: 'var(--red)', fontWeight: 700, fontSize: 12,
                        }}
                      >
                        <XCircle size={12} />
                        Cancel
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp delivery-status panel — admins only */}
      {isAdmin && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, #22c55e 13%, transparent)', border: '1px solid color-mix(in srgb, #22c55e 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <Send size={15} style={{ color: '#22c55e' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>WhatsApp Delivery Status</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Whether each customer notification was actually delivered</div>
            </div>
            <button
              type="button"
              onClick={() => setWhatsappMessagesReload(n => n + 1)}
              disabled={whatsappMessagesLoading}
              title="Refresh"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700,
                background: 'color-mix(in srgb, var(--gold) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)',
                color: 'var(--gold)', cursor: whatsappMessagesLoading ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={13} style={{ animation: whatsappMessagesLoading ? 'spin 1s linear infinite' : undefined }} />
              Refresh
            </button>
          </div>

          {whatsappMessagesLoading && whatsappMessages.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading recent notifications…</div>
          ) : whatsappMessages.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              No WhatsApp notifications have been sent yet. Once notifications are enabled and a customer order is placed or
              dispatched, delivery status will appear here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
              {whatsappMessages.map(m => {
                const badge = WA_STATUS_BADGE[m.status] ?? { color: 'var(--muted)', label: m.status };
                const ref = m.orderNo ? `Order ${m.orderNo}` : m.challanNo ? `Challan ${m.challanNo}` : '—';
                const eventLabel = WA_EVENT_LABEL[m.event] ?? m.event;
                return (
                  <div key={m.id} style={{
                    display: 'grid', gridTemplateColumns: 'minmax(120px,1.2fr) 1fr 1fr auto',
                    gap: 12, alignItems: 'center', padding: '12px 14px',
                    background: 'var(--chip-bg)',
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ref}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{eventLabel}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.toPhone ?? '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(m.updatedAt).toLocaleString()}</div>
                    <div style={{ justifySelf: 'end', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                        background: `color-mix(in srgb, ${badge.color} 14%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${badge.color} 35%, transparent)`,
                        color: badge.color, textTransform: 'capitalize',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: 999, background: badge.color }} />
                        {badge.label}
                      </span>
                      {m.errorCode && (
                        <span style={{ fontSize: 10, color: '#ef4444' }}>Twilio error {m.errorCode}</span>
                      )}
                      {WA_FAILED_STATUSES.has(m.status) && (
                        <button
                          type="button"
                          onClick={() => handleResendWhatsapp(m.id)}
                          disabled={whatsappResendingId !== null}
                          title="Re-send this notification"
                          style={{
                            marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                            background: 'color-mix(in srgb, var(--gold) 12%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)',
                            color: 'var(--gold)',
                            cursor: whatsappResendingId !== null ? 'not-allowed' : 'pointer',
                            opacity: whatsappResendingId !== null && whatsappResendingId !== m.id ? 0.5 : 1,
                          }}
                        >
                          <RefreshCw size={11} style={{ animation: whatsappResendingId === m.id ? 'spin 1s linear infinite' : undefined }} />
                          {whatsappResendingId === m.id ? 'Re-sending…' : 'Re-send'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Trip idle-charge settings card — admins only */}
      {isAdmin && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <Timer size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Trip Idle Charges</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Free waiting time after a truck arrives at site, and the optional charge for idle time beyond it</div>
            </div>
          </div>

          {idleLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading settings…</div>
          ) : (
            <form onSubmit={handleIdleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <SmtpTextField
                  label="Free window (minutes)"
                  type="number"
                  value={idleForm.freeMin}
                  onChange={v => setIdleForm(f => ({ ...f, freeMin: v }))}
                  placeholder={String(idleDefaults.freeMin)}
                />
                <SmtpTextField
                  label="Idle rate (₹ / hour)"
                  type="number"
                  value={idleForm.ratePerHour}
                  onChange={v => setIdleForm(f => ({ ...f, ratePerHour: v }))}
                  placeholder="No charge"
                />
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                A truck's time at site is measured from <strong style={{ color: 'var(--text)' }}>site arrival</strong> to
                <strong style={{ color: 'var(--text)' }}> site release</strong>. The first {idleForm.freeMin || idleDefaults.freeMin} minutes
                are free; anything beyond is billable idle. Set an idle rate to also compute a charge
                (billable idle ÷ 60 × rate). Clear the free window to fall back to the default
                ({idleDefaults.freeMin} min). Leave the rate blank to track idle time without a money figure.
              </div>

              <button
                type="submit"
                disabled={idleSaving}
                style={{
                  marginTop: 14, padding: '10px 22px', borderRadius: 10,
                  background: idleSaving ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'linear-gradient(135deg,var(--gold),var(--gold-dark))',
                  border: 'none', cursor: idleSaving ? 'not-allowed' : 'pointer',
                  color: '#111', fontWeight: 800, fontSize: 14,
                  transition: 'opacity .15s',
                }}
              >
                {idleSaving ? 'Saving…' : 'Save idle settings'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Diesel cost-control & theft-alert settings card — admins only */}
      {isAdmin && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <Fuel size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Diesel & Theft Alerts</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Fuel reconciliation tolerance, idle burn rate, and the plant location used to detect unscheduled stops & route deviations</div>
            </div>
          </div>

          {fuelLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading settings…</div>
          ) : (
            <form onSubmit={handleFuelSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <SmtpTextField
                  label="Reconciliation variance (%)"
                  type="number"
                  value={fuelForm.reconVariancePct}
                  onChange={v => setFuelForm(f => ({ ...f, reconVariancePct: v }))}
                  placeholder={fuelDefaults ? String(fuelDefaults.reconVariancePct) : '15'}
                />
                <SmtpTextField
                  label="Default idle burn (L / hour)"
                  type="number"
                  value={fuelForm.idleBurnLph}
                  onChange={v => setFuelForm(f => ({ ...f, idleBurnLph: v }))}
                  placeholder={fuelDefaults ? String(fuelDefaults.idleBurnLph) : '2'}
                />
                <SmtpTextField
                  label="Unscheduled stop (minutes)"
                  type="number"
                  value={fuelForm.unscheduledStopMin}
                  onChange={v => setFuelForm(f => ({ ...f, unscheduledStopMin: v }))}
                  placeholder={fuelDefaults ? String(fuelDefaults.unscheduledStopMin) : '10'}
                />
                <SmtpTextField
                  label="Route deviation (metres)"
                  type="number"
                  value={fuelForm.routeDeviationM}
                  onChange={v => setFuelForm(f => ({ ...f, routeDeviationM: v }))}
                  placeholder={fuelDefaults ? String(fuelDefaults.routeDeviationM) : '500'}
                />
                <SmtpTextField
                  label="Plant latitude"
                  type="number"
                  value={fuelForm.plantLat}
                  onChange={v => setFuelForm(f => ({ ...f, plantLat: v }))}
                  placeholder="e.g. 23.0225"
                />
                <SmtpTextField
                  label="Plant longitude"
                  type="number"
                  value={fuelForm.plantLng}
                  onChange={v => setFuelForm(f => ({ ...f, plantLng: v }))}
                  placeholder="e.g. 72.5714"
                />
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                Reconciliation compares logged diesel against expected use (distance ÷ each vehicle's mileage + idle hours × idle burn);
                vehicles over the variance threshold are flagged as possible theft or leakage. The plant location anchors stop &
                deviation detection — a truck idling away from the plant/site beyond the unscheduled-stop window, or drifting past the
                route-deviation distance, raises an alert. Per-vehicle mileage and idle burn live on each <strong style={{ color: 'var(--text)' }}>Fleet</strong> record; the idle burn here is the fallback when a vehicle has none.
              </div>

              <button
                type="submit"
                disabled={fuelSaving}
                style={{
                  marginTop: 14, padding: '10px 22px', borderRadius: 10,
                  background: fuelSaving ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'linear-gradient(135deg,var(--gold),var(--gold-dark))',
                  border: 'none', cursor: fuelSaving ? 'not-allowed' : 'pointer',
                  color: '#111', fontWeight: 800, fontSize: 14,
                  transition: 'opacity .15s',
                }}
              >
                {fuelSaving ? 'Saving…' : 'Save fuel settings'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Login lockouts card — admins only */}
      {isAdmin && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)',
              display: 'grid', placeItems: 'center',
            }}>
              <Lock size={15} style={{ color: 'var(--red)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Login Lockouts</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Accounts locked after too many failed sign-in attempts</div>
            </div>
            <button
              type="button"
              onClick={() => setLockoutsReload(n => n + 1)}
              disabled={lockoutsLoading}
              title="Refresh"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 9,
                background: 'var(--chip-bg)', border: '1px solid var(--line)',
                cursor: lockoutsLoading ? 'not-allowed' : 'pointer',
                color: 'var(--muted)', fontWeight: 700, fontSize: 12,
              }}
            >
              <RefreshCw size={13} style={{ animation: lockoutsLoading ? 'spin 1s linear infinite' : undefined }} />
              Refresh
            </button>
          </div>

          {lockouts.length === 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '14px 16px', borderRadius: 10,
              background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)',
              color: 'var(--muted)', fontSize: 13, fontWeight: 600,
            }}>
              <CheckCircle size={15} style={{ color: 'var(--green)', flexShrink: 0 }} />
              {lockoutsLoading ? 'Loading lockouts…' : 'No accounts are currently locked out.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {lockouts.map(l => {
                const remaining = new Date(l.lockedUntil).getTime() - now;
                const clearing = clearingKey === l.key;
                return (
                  <div
                    key={l.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 12,
                      background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.18)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 700, color: 'var(--text)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {lockoutLabel(l.key)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                        {l.count} failed attempt{l.count !== 1 ? 's' : ''} · unlocks in{' '}
                        <strong style={{ color: 'var(--red)' }}>{formatRemaining(remaining)}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleClearLockout(l.key)}
                      disabled={clearing}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                        padding: '8px 14px', borderRadius: 9,
                        background: clearing ? 'rgba(34,197,94,.35)' : 'linear-gradient(135deg,var(--green),#16a34a)',
                        border: 'none', cursor: clearing ? 'not-allowed' : 'pointer',
                        color: '#fff', fontWeight: 700, fontSize: 12.5,
                      }}
                    >
                      <Unlock size={13} />
                      {clearing ? 'Clearing…' : 'Clear'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Stuck proof-photo recovery card — admins only */}
      {isAdmin && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.25)',
              display: 'grid', placeItems: 'center',
            }}>
              <ImageUp size={15} style={{ color: 'var(--blue)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Delivery Photo Recovery</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Re-upload proof photos that failed to move to storage</div>
            </div>
            <button
              type="button"
              onClick={() => setStuckReload(n => n + 1)}
              disabled={stuckLoading || retrying}
              title="Refresh"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 9,
                background: 'var(--chip-bg)', border: '1px solid var(--line)',
                cursor: (stuckLoading || retrying) ? 'not-allowed' : 'pointer',
                color: 'var(--muted)', fontWeight: 700, fontSize: 12,
              }}
            >
              <RefreshCw size={13} style={{ animation: stuckLoading ? 'spin 1s linear infinite' : undefined }} />
              Refresh
            </button>
          </div>

          {stuckPhotos === 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '14px 16px', borderRadius: 10,
              background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)',
              color: 'var(--muted)', fontSize: 13, fontWeight: 600,
            }}>
              <CheckCircle size={15} style={{ color: 'var(--green)', flexShrink: 0 }} />
              {stuckLoading ? 'Checking for stuck photos…' : 'All delivery photos are stored safely. Nothing to recover.'}
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 12,
              background: 'rgba(56,189,248,.07)', border: '1px solid rgba(56,189,248,.18)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {stuckPhotos === null
                    ? (stuckLoading ? 'Checking for stuck photos…' : 'Stuck photo status unavailable')
                    : `${stuckPhotos} delivery photo${stuckPhotos !== 1 ? 's' : ''} stuck`}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                  These never reached storage. Retry once the storage issue is resolved.
                </div>
              </div>
              <button
                type="button"
                onClick={handleRetryProofPhotos}
                disabled={retrying || stuckLoading || !stuckPhotos}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  padding: '8px 14px', borderRadius: 9,
                  background: retrying ? 'rgba(56,189,248,.35)' : 'linear-gradient(135deg,var(--blue),#0ea5e9)',
                  border: 'none', cursor: (retrying || stuckLoading || !stuckPhotos) ? 'not-allowed' : 'pointer',
                  color: '#fff', fontWeight: 700, fontSize: 12.5,
                }}
              >
                <RefreshCw size={13} style={{ animation: retrying ? 'spin 1s linear infinite' : undefined }} />
                {retrying ? 'Retrying…' : 'Retry now'}
              </button>
            </div>
          )}

          {retryResult && (
            <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', borderRadius: 10,
                background: retryResult.failed > 0 ? 'rgba(239,68,68,.08)' : 'rgba(34,197,94,.08)',
                border: `1px solid ${retryResult.failed > 0 ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.2)'}`,
                color: 'var(--text)', fontSize: 12.5, fontWeight: 600,
              }}>
                {retryResult.failed > 0
                  ? <XCircle size={15} style={{ color: 'var(--red)', flexShrink: 0 }} />
                  : <CheckCircle size={15} style={{ color: 'var(--green)', flexShrink: 0 }} />}
                <span>
                  {retryResult.migrated} recovered · {retryResult.skipped} skipped · {retryResult.failed} still failed
                </span>
              </div>
              {retryResult.failures.length > 0 && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)',
                  fontSize: 11.5, color: 'var(--muted)',
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                    Still failing — retry again once resolved:
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {retryResult.failures.map(f => (
                      <div key={f.id} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Photo #{f.id} (challan {f.challanId}): {f.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Change password card */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'color-mix(in srgb, var(--gold) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 25%, transparent)',
            display: 'grid', placeItems: 'center',
          }}>
            <KeyRound size={15} style={{ color: 'var(--gold)' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Change Password</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Requires your current password to confirm</div>
          </div>
        </div>

        {success && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)',
            color: 'var(--green)', fontSize: 13, fontWeight: 600,
          }}>
            <CheckCircle size={15} />
            Password changed successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={label}>Current Password</label>
            <PasswordInput
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="Enter your current password"
            />
          </div>
          <div>
            <label style={label}>New Password</label>
            <PasswordInput
              value={newPassword}
              onChange={setNewPassword}
              placeholder="At least 6 characters"
            />
          </div>
          <div>
            <label style={label}>Confirm New Password</label>
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Repeat new password"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 5 }}>
                Passwords do not match
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            style={{
              marginTop: 4, padding: '11px 22px', borderRadius: 10,
              background: saving ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : 'linear-gradient(135deg,var(--gold),#e5a800)',
              border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              color: '#111827', fontWeight: 800, fontSize: 14,
              opacity: (!currentPassword || !newPassword || !confirmPassword) ? 0.5 : 1,
              transition: 'opacity .15s',
            }}
          >
            {saving ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Danger zone — self-service account deletion (hidden for Super Admin,
          which the backend also refuses to delete). */}
      {user?.role !== 'authority' && (
        <div style={{
          ...card, marginBottom: 20, marginTop: 20,
          border: '1px solid rgba(239,68,68,.35)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <XCircle size={18} style={{ color: 'var(--red)' }} />
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--red)', margin: 0 }}>
              Danger Zone
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0, marginBottom: 12 }}>
            Permanently delete your account. You will be signed out immediately and will no longer
            be able to log in. Business records (orders, delivery challans, invoices) are retained
            as required for legal and tax compliance.
          </p>

          {!showDeleteZone ? (
            <button
              type="button"
              onClick={() => setShowDeleteZone(true)}
              style={{
                padding: '10px 18px', borderRadius: 10,
                background: 'transparent', border: '1px solid rgba(239,68,68,.5)',
                color: 'var(--red)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              Delete my account…
            </button>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ fontSize: 12, color: 'var(--muted)' }}>
                Type <strong style={{ color: 'var(--red)' }}>DELETE</strong> to confirm:
              </label>
              <input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                style={{
                  padding: '10px 12px', borderRadius: 10, fontSize: 14,
                  background: 'var(--glass-1)', border: '1px solid rgba(239,68,68,.35)',
                  color: 'var(--text)', outline: 'none', maxWidth: 220,
                }}
              />
              {deleteError && (
                <div style={{ fontSize: 12, color: 'var(--red)' }}>{deleteError}</div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  disabled={deleteConfirmText !== 'DELETE' || deleteBusy}
                  onClick={handleDeleteAccount}
                  style={{
                    padding: '10px 18px', borderRadius: 10,
                    background: deleteConfirmText === 'DELETE' && !deleteBusy ? 'var(--red)' : 'rgba(239,68,68,.25)',
                    border: 'none', color: '#fff', fontWeight: 800, fontSize: 13,
                    cursor: deleteConfirmText === 'DELETE' && !deleteBusy ? 'pointer' : 'not-allowed',
                  }}
                >
                  {deleteBusy ? 'Deleting…' : 'Permanently delete account'}
                </button>
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => { setShowDeleteZone(false); setDeleteConfirmText(''); setDeleteError(''); }}
                  style={{
                    padding: '10px 18px', borderRadius: 10,
                    background: 'transparent', border: '1px solid var(--glass-border)',
                    color: 'var(--muted)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
