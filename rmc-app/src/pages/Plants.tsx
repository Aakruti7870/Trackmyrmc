import { useEffect, useMemo, useRef, useState } from 'react';
import { Factory, Plus, Pencil, Trash2, X, Check, MapPin, ShieldCheck, ShieldAlert, Power, BadgeCheck, Sprout, KeyRound, UserPlus, Mail, Users, HandHeart, Inbox, Sparkles, Upload, AlertTriangle, CheckCircle2, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import type { ImportResult } from '@/lib/importCsv';
import { useSSE } from '@/lib/useSSE';
import LocationPicker, { type LatLng } from '@/components/LocationPicker';
import BulkImportPanel from '@/components/BulkImportPanel';

type PlantStatus = 'pending' | 'approved' | 'rejected';

interface Plant {
  id: number;
  name: string;
  legalName: string | null;
  gstNo: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  contactNumber: string | null;
  latitude: string;
  longitude: string;
  plantStatus: PlantStatus;
  isActive: boolean;
  locationVerified: boolean;
  verified: boolean;
  deliveryRadiusKm: number;
  grades: string[];
  openTime: string | null;
  closeTime: string | null;
  ownerCount: number;
}

type OwnerRole = 'plant_owner' | 'admin' | 'supervisor' | 'dispatcher' | 'plant_operator' | 'driver';

interface PlantLogin {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

type InviteStatus = 'pending' | 'onboarded' | 'dismissed';

// A customer/staff request to onboard a real-world plant discovered live on the
// map directory (Google Places), de-duplicated by placeId server-side.
interface PlantInvite {
  id: number;
  placeId: string;
  name: string;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  contactNumber: string | null;
  requestCount: number;
  status: InviteStatus;
  firstRequestedByName: string | null;
  lastRequestedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  plant_owner: 'Plant Owner',
  admin: 'Owner',
  supervisor: 'Supervisor',
  dispatcher: 'Dispatcher',
  plant_operator: 'Plant operator',
  driver: 'Driver',
};

const ALL_GRADES = ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40', 'M-45', 'M-50', 'M-55', 'M-60'];

interface FormState {
  name: string; legalName: string; gstNo: string; email: string;
  address: string; city: string; contactNumber: string;
  latitude: string; longitude: string;
  // Google Places placeId — populated when onboarding via a customer invite.
  // Persisted on the plant for de-duplication on the server.
  placeId: string;
  plantStatus: PlantStatus;
  isActive: boolean; locationVerified: boolean; verified: boolean; deliveryRadiusKm: number;
  grades: string[]; openTime: string; closeTime: string;
}

const emptyForm: FormState = {
  name: '', legalName: '', gstNo: '', email: '', address: '', city: '', contactNumber: '', latitude: '', longitude: '',
  placeId: '',
  plantStatus: 'pending', isActive: true, locationVerified: false, verified: false, deliveryRadiusKm: 25,
  grades: [], openTime: '06:00', closeTime: '20:00',
};

const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
function isValidGst(gst: string): boolean {
  return GST_RE.test(gst.trim().toUpperCase());
}

interface AutoInviteLink {
  name: string;
  email: string;
  inviteUrl?: string;
}

interface AutoInviteError {
  email: string;
  reason: string;
}

// Minimal shape of a /plants/nearby row we use for the inline duplicate warning.
interface NearbyDupe {
  id: number;
  name: string;
  city: string | null;
  distanceKm: number;
}

interface ExtractedFields {
  legalName: string | null;
  gstNo: string | null;
  contactNumber: string | null;
  email: string | null;
  confidence: 'high' | 'low' | 'none';
  warning?: string;
}

// A plant is a verified partner once company details are confirmed and staff flip
// `verified`. Everything else is still an onboarding lead, even if approved/active.
function isLead(p: Plant): boolean { return !p.verified; }

// Marking a plant verified publishes it to the customer-facing directory, so the
// key company details that customers (and challans) rely on must be filled in
// first. Returns the human-readable labels of whatever is still missing.
function missingVerifyFields(src: {
  legalName: string | null; gstNo: string | null; contactNumber: string | null; email: string | null;
}): string[] {
  const checks: [string | null, string][] = [
    [src.legalName, 'legal / company name'],
    [src.gstNo, 'GST number'],
    [src.contactNumber, 'contact number'],
    [src.email, 'email'],
  ];
  return checks.filter(([v]) => !v || !String(v).trim()).map(([, label]) => label);
}

const ownerEmpty = { name: '', email: '', password: '', role: 'admin' as OwnerRole, setOwnPassword: true };

export default function Plants() {
  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  // Async near-duplicate check fired as the map pin moves (debounced). Surfaces a
  // soft inline warning while the form is still open; the server 409 remains the
  // authoritative hard stop on save.
  const [dupeNearby, setDupeNearby] = useState<NearbyDupe | null>(null);
  const [dupeDismissed, setDupeDismissed] = useState(false);
  const [tab, setTab] = useState<'leads' | 'verified' | 'invites'>('leads');
  // Customer-submitted onboarding requests for discovered plants.
  const [invites, setInvites] = useState<PlantInvite[] | null>(null);
  const [invitesError, setInvitesError] = useState('');
  const [busyInviteId, setBusyInviteId] = useState<number | null>(null);
  // Live "unread" marker: bumped when a new request streams in via SSE while the
  // admin is not looking at the Onboarding-requests tab. Cleared on tab open.
  const [unseenInvites, setUnseenInvites] = useState(0);
  const { subscribe } = useSSE();
  // Owner-provisioning modal state.
  const [ownerFor, setOwnerFor] = useState<Plant | null>(null);
  const [ownerForm, setOwnerForm] = useState(ownerEmpty);
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerError, setOwnerError] = useState('');
  const [ownerDone, setOwnerDone] = useState('');
  // Manage-logins modal state.
  const [loginsFor, setLoginsFor] = useState<Plant | null>(null);
  const [logins, setLogins] = useState<PlantLogin[] | null>(null);
  const [loginsError, setLoginsError] = useState('');
  const [loginsNotice, setLoginsNotice] = useState('');
  const [busyLoginId, setBusyLoginId] = useState<number | null>(null);
  // Fallback link shown when an invite was created but the email couldn't be sent.
  const [ownerInviteUrl, setOwnerInviteUrl] = useState('');
  // AI document extraction state.
  const [showDocPanel, setShowDocPanel] = useState(false);
  const [docText, setDocText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extractWarning, setExtractWarning] = useState('');
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Auto-invite notification shown after verification.
  const [autoInviteResult, setAutoInviteResult] = useState<{ sent: number; links: AutoInviteLink[]; errors?: AutoInviteError[] } | null>(null);

  // Bulk CSV import (Leads tab) — the panel owns all import state internally.
  const [showImport, setShowImport] = useState(false);

  function load() {
    api.get<Plant[]>('/plants')
      .then(p => { setPlants(p); setError(''); })
      .catch(e => { setError((e as Error).message); setPlants([]); });
  }
  function loadInvites() {
    api.get<PlantInvite[]>('/plants/invites')
      .then(rows => { setInvites(rows); setInvitesError(''); })
      .catch(e => { setInvitesError((e as Error).message); setInvites([]); });
  }
  useEffect(() => { load(); loadInvites(); }, []);

  // Debounced near-duplicate check: as the map pin is dropped/dragged while the
  // form is open, ask the server which verified plants sit within 0.3 km and warn
  // inline. Purely advisory — the POST/PUT 409 guard is the real enforcement.
  useEffect(() => {
    if (!showForm) return;
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    const t = setTimeout(() => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setDupeNearby(null);
        return;
      }
      api
        .get<NearbyDupe[]>(`/plants/nearby?lat=${lat}&lng=${lng}&radius=0.3`)
        // Exclude the plant being edited so it never flags itself.
        .then(rows => rows.filter(r => r.id !== editId))
        .then(rows => {
          setDupeNearby(rows[0] ?? null);
          setDupeDismissed(false);
        })
        // Soft feature — a failed lookup must never block the form.
        .catch(() => setDupeNearby(null));
    }, 500);
    return () => clearTimeout(t);
  }, [showForm, form.latitude, form.longitude, editId]);

  // Run a bulk plant import for the panel; refresh the list when rows landed.
  async function importPlantsCsv(csv: string): Promise<ImportResult> {
    const res = await api.post<ImportResult>('/plants/import', { csv });
    if (res.created > 0) load();
    return res;
  }

  // Keep the queue live: a streamed-in request refreshes the list and, unless
  // the admin is already on the tab, lights up an unread marker on it.
  useEffect(() => {
    const unsub = subscribe('plant.invite', () => {
      loadInvites();
      setTab(t => {
        if (t !== 'invites') setUnseenInvites(n => n + 1);
        return t;
      });
    });
    return unsub;
  }, [subscribe]);

  // Opening the tab acknowledges everything that streamed in while away.
  function openInvitesTab() { setTab('invites'); setUnseenInvites(0); }

  async function setInviteStatus(inv: PlantInvite, status: InviteStatus) {
    setBusyInviteId(inv.id);
    setInvitesError('');
    try {
      await api.patch(`/plants/invites/${inv.id}`, { status });
      loadInvites();
    } catch (err) {
      setInvitesError((err as Error).message || 'Could not update the request.');
    } finally {
      setBusyInviteId(null);
    }
  }

  // Prefill the Add-Plant form from a customer's onboarding request so staff can
  // turn the lead into a real plant in one step. The placeId is carried over so
  // the server can enforce the per-placeId duplicate guard on verify.
  function onboardInvite(inv: PlantInvite) {
    setForm({
      ...emptyForm,
      name: inv.name,
      address: inv.address ?? '',
      contactNumber: inv.contactNumber ?? '',
      latitude: inv.latitude ?? '',
      longitude: inv.longitude ?? '',
      placeId: inv.placeId ?? '',
    });
    setEditId(null);
    resetExtractionState();
    setAutoInviteResult(null);
    setShowForm(true);
  }

  function resetExtractionState() {
    setShowDocPanel(false);
    setDocText('');
    setExtractError('');
    setExtractWarning('');
    setAutoFilled(new Set());
    setDupeNearby(null);
    setDupeDismissed(false);
  }

  function openCreate() {
    setForm(emptyForm);
    setEditId(null);
    resetExtractionState();
    setAutoInviteResult(null);
    setShowForm(true);
  }

  function openEdit(p: Plant) {
    setForm({
      name: p.name, legalName: p.legalName ?? '', gstNo: p.gstNo ?? '', email: p.email ?? '',
      address: p.address ?? '', city: p.city ?? '', contactNumber: p.contactNumber ?? '',
      latitude: p.latitude, longitude: p.longitude,
      placeId: (p as Plant & { placeId?: string }).placeId ?? '',
      plantStatus: p.plantStatus,
      isActive: p.isActive, locationVerified: p.locationVerified, verified: p.verified, deliveryRadiusKm: p.deliveryRadiusKm,
      grades: p.grades, openTime: p.openTime ?? '', closeTime: p.closeTime ?? '',
    });
    setEditId(p.id);
    resetExtractionState();
    setAutoInviteResult(null);
    setShowForm(true);
  }

  // AI document extraction: upload an image, reference an object-storage path, or paste text to auto-fill form fields.
  async function extractDocument(input: { type: 'image'; data: string; mimeType: string } | { type: 'text'; data: string } | { type: 'object'; objectPath: string; mimeType: string }) {
    setExtracting(true);
    setExtractError('');
    setExtractWarning('');
    try {
      const result = await api.post<ExtractedFields>('/plants/extract-doc', input);
      if (result.confidence === 'none') {
        setExtractError('No registration or GST data found in the document. Please try a clearer image or paste the text instead.');
        return;
      }
      // Map extracted fields onto the form, only overwriting empty fields or all
      // fields depending on what was found. Track which keys were auto-populated.
      const filled = new Set<string>();
      setForm(f => {
        const next = { ...f };
        if (result.legalName && !f.legalName.trim()) { next.legalName = result.legalName; filled.add('legalName'); }
        if (result.gstNo && !f.gstNo.trim()) { next.gstNo = result.gstNo; filled.add('gstNo'); }
        if (result.contactNumber && !f.contactNumber.trim()) { next.contactNumber = result.contactNumber; filled.add('contactNumber'); }
        if (result.email && !f.email.trim()) { next.email = result.email; filled.add('email'); }
        return next;
      });
      setAutoFilled(prev => new Set([...prev, ...filled]));
      if (result.confidence === 'low') {
        setExtractWarning(result.warning ?? 'Some fields may be inaccurate — the document was partially readable. Please verify the auto-filled values.');
      }
      if (filled.size === 0) {
        setExtractWarning('All fields were already filled. No changes were made from the document.');
      }
      setShowDocPanel(false);
      setDocText('');
    } catch (err) {
      setExtractError((err as Error).message || 'Document extraction failed. Please try again.');
    } finally {
      setExtracting(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset the input so the same file can be re-selected.
    e.target.value = '';

    const mimeType = file.type || 'application/octet-stream';
    setExtracting(true);
    setExtractError('');
    setExtractWarning('');

    try {
      // 1. Get a presigned PUT URL from the server.
      const { uploadURL, objectPath } = await api.post<{ uploadURL: string; objectPath: string }>(
        '/plants/extract-doc/upload-url', {},
      );

      // 2. Upload the file directly to object storage via the presigned URL.
      const uploadRes = await fetch(uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error(`Upload failed (${uploadRes.status}). Please try again.`);
      }

      // 3. Ask the server to extract fields from the stored object.
      await extractDocument({ type: 'object', objectPath, mimeType });
    } catch (err) {
      setExtractError((err as Error).message || 'File upload failed. Please try again.');
      setExtracting(false);
    }
  }

  function openOwner(p: Plant) {
    setOwnerFor(p);
    setOwnerForm(ownerEmpty);
    setOwnerError('');
    setOwnerDone('');
    setOwnerInviteUrl('');
  }

  function loadLogins(plantId: number) {
    setLogins(null);
    setLoginsError('');
    api.get<PlantLogin[]>(`/plants/${plantId}/owner`)
      .then(setLogins)
      .catch(e => { setLoginsError((e as Error).message); setLogins([]); });
  }

  function openLogins(p: Plant) {
    setLoginsFor(p);
    setLoginsNotice('');
    loadLogins(p.id);
  }

  async function toggleLoginActive(u: PlantLogin) {
    setBusyLoginId(u.id);
    setLoginsError('');
    setLoginsNotice('');
    try {
      await api.put(`/users/${u.id}`, { isActive: !u.isActive });
      setLoginsNotice(`${u.name} ${u.isActive ? 'deactivated' : 'reactivated'}.`);
      if (loginsFor) loadLogins(loginsFor.id);
      load();
    } catch (err) {
      setLoginsError((err as Error).message || 'Could not update the login.');
    } finally {
      setBusyLoginId(null);
    }
  }

  async function resendWelcome(u: PlantLogin) {
    setBusyLoginId(u.id);
    setLoginsError('');
    setLoginsNotice('');
    try {
      const res = await api.post<{ emailSent?: boolean }>(`/users/${u.id}/resend-welcome`, {});
      setLoginsNotice(res.emailSent
        ? `Welcome email re-sent to ${u.email}.`
        : `Could not send the welcome email to ${u.email} — SMTP is not configured.`);
    } catch (err) {
      setLoginsError((err as Error).message || 'Could not resend the welcome email.');
    } finally {
      setBusyLoginId(null);
    }
  }

  async function provisionOwner(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerFor) return;
    if (!ownerForm.name.trim() || !ownerForm.email.trim()) {
      setOwnerError('Owner name and email are required.');
      return;
    }
    // setOwnPassword === false → invite flow (no password sent). Otherwise the
    // legacy typed-password flow, which still requires a 6+ char password.
    const typedPassword = ownerForm.setOwnPassword === false;
    if (typedPassword && ownerForm.password.length < 6) {
      setOwnerError('A password of at least 6 characters is required.');
      return;
    }
    setOwnerSaving(true);
    setOwnerError('');
    try {
      const payload = typedPassword
        ? { name: ownerForm.name, email: ownerForm.email, password: ownerForm.password, role: ownerForm.role }
        : { name: ownerForm.name, email: ownerForm.email, role: ownerForm.role };
      const res = await api.post<{ emailSent?: boolean; invited?: boolean; inviteUrl?: string }>(
        `/plants/${ownerFor.id}/owner`, payload);
      if (res.invited) {
        setOwnerDone(res.emailSent
          ? `Owner account created — an invite to set their own password was emailed to ${ownerForm.email}.`
          : `Owner account created for ${ownerForm.email}. Email could not be sent (SMTP not configured) — copy the secure link below and share it with them.`);
        setOwnerInviteUrl(res.inviteUrl ?? '');
      } else {
        setOwnerDone(res.emailSent
          ? `Owner login created — a welcome email was sent to ${ownerForm.email}.`
          : `Owner login created for ${ownerForm.email}. (Welcome email not sent — SMTP not configured.)`);
        setOwnerInviteUrl('');
      }
      load();
    } catch (err) {
      setOwnerError((err as Error).message || 'Could not create the owner login.');
    } finally {
      setOwnerSaving(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.latitude || !form.longitude) {
      setError('Name and map location are required.');
      return;
    }
    // Client-side GST format validation when about to verify.
    if (form.verified && form.gstNo.trim() && !isValidGst(form.gstNo)) {
      setError(`"${form.gstNo.trim()}" is not a valid Indian GST number (format: 29ABCDE1234F1Z5).`);
      return;
    }
    // Verifying publishes to the customer-facing directory — warn if onboarding
    // details are still missing before saving the verified flag.
    if (form.verified) {
      const missing = missingVerifyFields(form);
      if (missing.length > 0) {
        const ok = confirm(
          `This plant is missing ${missing.join(', ')}.\n\n` +
          `Verified plants are published to the customer-facing marketplace. ` +
          `Save it as verified anyway?`,
        );
        if (!ok) return;
      }
    }
    setSaving(true);
    setError('');
    const payload = { ...form, deliveryRadiusKm: Number(form.deliveryRadiusKm) || 0 };
    try {
      let res: Plant & { autoInvitesSent?: number; autoInviteLinks?: AutoInviteLink[]; autoInviteErrors?: AutoInviteError[] };
      if (editId != null) {
        res = await api.put<typeof res>(`/plants/${editId}`, payload);
      } else {
        res = await api.post<typeof res>('/plants', payload);
      }
      setShowForm(false);
      resetExtractionState();
      // Show auto-invite notification whenever the server processed invites (sent or failed).
      if ((res.autoInvitesSent && res.autoInvitesSent > 0) || res.autoInviteErrors?.length) {
        setAutoInviteResult({ sent: res.autoInvitesSent ?? 0, links: res.autoInviteLinks ?? [], errors: res.autoInviteErrors });
      }
      load();
    } catch (err) {
      setError((err as Error).message || 'Could not save plant.');
    } finally {
      setSaving(false);
    }
  }

  function toggleVerified(p: Plant) {
    // Only guard the publish direction — un-verifying always needs no warning.
    if (!p.verified) {
      const missing = missingVerifyFields(p);
      if (missing.length > 0) {
        const ok = confirm(
          `"${p.name}" is missing ${missing.join(', ')}.\n\n` +
          `Verified plants are published to the customer-facing marketplace. ` +
          `Mark it verified anyway?`,
        );
        if (!ok) return;
      }
    }
    patch(p, { verified: !p.verified });
  }

  async function patch(p: Plant, changes: Partial<Plant>) {
    setError('');
    try {
      const res = await api.put<Plant & { autoInvitesSent?: number; autoInviteLinks?: AutoInviteLink[]; autoInviteErrors?: AutoInviteError[] }>(`/plants/${p.id}`, changes);
      if ((res.autoInvitesSent && res.autoInvitesSent > 0) || res.autoInviteErrors?.length) {
        setAutoInviteResult({ sent: res.autoInvitesSent ?? 0, links: res.autoInviteLinks ?? [], errors: res.autoInviteErrors });
      }
      load();
    } catch (err) { setError((err as Error).message); }
  }

  async function remove(p: Plant) {
    if (!confirm(`Delete plant "${p.name}"? This cannot be undone.`)) return;
    try { await api.delete(`/plants/${p.id}`); load(); }
    catch (err) { setError((err as Error).message); }
  }

  const leads = useMemo(() => (plants ?? []).filter(isLead), [plants]);
  const verified = useMemo(() => (plants ?? []).filter(p => !isLead(p)), [plants]);
  const visible = tab === 'verified' ? verified : leads;
  const pendingInviteCount = useMemo(() => (invites ?? []).filter(i => i.status === 'pending').length, [invites]);

  const pin: LatLng | null = form.latitude && form.longitude
    ? { lat: parseFloat(form.latitude), lng: parseFloat(form.longitude) } : null;

  return (
    <div style={{ padding: '22px clamp(14px, 4vw, 34px)', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 900, letterSpacing: '-0.6px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Factory size={26} style={{ color: 'var(--gold)' }} /> Plants
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            Onboard marketplace plants. Customers only ever see <strong style={{ color: 'var(--text)' }}>verified</strong> partners — onboarding leads stay hidden until you confirm their details.
          </p>
        </div>
        <button onClick={openCreate} style={primaryBtn}><Plus size={16} /> Add Plant</button>
      </div>

      {error && <div style={{ ...softCard, borderColor: 'color-mix(in srgb, var(--red) 45%, transparent)', color: 'var(--red)', marginBottom: 14, fontSize: 13.5 }}>{error}</div>}

      {plants == null ? (
        <div style={{ color: 'var(--muted)', padding: 30 }}>Loading…</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <button onClick={() => setTab('leads')} style={tabBtn(tab === 'leads', 'var(--gold)')}>
              <Sprout size={14} /> Leads <span style={countPill}>{leads.length}</span>
            </button>
            <button onClick={() => setTab('verified')} style={tabBtn(tab === 'verified', 'var(--green)')}>
              <BadgeCheck size={14} /> Verified partners <span style={countPill}>{verified.length}</span>
            </button>
            <button onClick={openInvitesTab} style={{ ...tabBtn(tab === 'invites', 'var(--blue)'), position: 'relative' }}>
              <HandHeart size={14} /> Onboarding requests <span style={countPill}>{pendingInviteCount}</span>
              {unseenInvites > 0 && (
                <span style={unreadDot} title={`${unseenInvites} new request${unseenInvites === 1 ? '' : 's'}`}>
                  {unseenInvites > 9 ? '9+' : unseenInvites}
                </span>
              )}
            </button>
            {tab === 'leads' && (
              <button
                onClick={() => setShowImport(v => !v)}
                style={{ ...tabBtn(showImport, 'var(--blue)'), marginLeft: 'auto' }}
                title="Bulk-import a spreadsheet of new plants as leads"
              >
                <Upload size={14} /> Import CSV
              </button>
            )}
          </div>

          {tab === 'leads' && showImport && (
            <BulkImportPanel
              title="Bulk-import plants from CSV"
              description={<>Upload a spreadsheet to add many onboarding leads at once. Required columns: <strong style={{ color: 'var(--text)' }}>name, latitude, longitude</strong>. Optional: address, city, contactNumber, email, legalName, gstNo. Each valid row is added as an un-verified lead; invalid rows are skipped with a reason.</>}
              onImport={importPlantsCsv}
              template={{ fileName: 'plant-import-template.csv', content: PLANT_CSV_TEMPLATE }}
              nameColumnLabel="Plant"
              skippedFileName="skipped-rows.csv"
            />
          )}

          {tab === 'invites' ? (
            <InvitesPanel
              invites={invites}
              error={invitesError}
              busyId={busyInviteId}
              onOnboard={onboardInvite}
              onSetStatus={setInviteStatus}
            />
          ) : plants.length === 0 ? (
            <div style={{ ...softCard, textAlign: 'center', color: 'var(--muted)' }}>No plants yet. Add your first plant.</div>
          ) : visible.length === 0 ? (
            <div style={{ ...softCard, textAlign: 'center', color: 'var(--muted)' }}>
              {tab === 'leads' ? 'No onboarding leads left — every plant is verified.' : 'No verified partners yet. Onboard a lead to get started.'}
            </div>
          ) : (
          <div style={{ display: 'grid', gap: 12 }}>
          {visible.map(p => {
            const lead = isLead(p);
            const live = p.verified && p.plantStatus === 'approved' && p.isActive && p.locationVerified;
            return (
              <div key={p.id} style={{ ...softCard, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between', borderColor: lead ? 'color-mix(in srgb, var(--gold) 32%, transparent)' : 'var(--line)' }}>
                <div style={{ minWidth: 220, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{p.name}</span>
                    {lead
                      ? <span style={badge('var(--gold)')}><Sprout size={11} /> LEAD</span>
                      : <span style={badge('var(--green)')}><BadgeCheck size={11} /> VERIFIED</span>}
                    {live && <span style={badge('var(--blue)')}>LIVE</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
                    {[p.address, p.city].filter(Boolean).join(', ') || '—'} · {p.contactNumber || 'no contact'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                    {p.gstNo ? `GST ${p.gstNo}` : 'no GST'} · {p.email || 'no email'} ·{' '}
                    {p.ownerCount > 0 ? (
                      <button onClick={() => openLogins(p)} style={linkBtn} title="View and manage the logins for this plant">
                        {p.ownerCount} login{p.ownerCount > 1 ? 's' : ''}
                      </button>
                    ) : 'no owner login'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                    {p.grades.join(', ') || 'no grades'} · delivers {p.deliveryRadiusKm} km · {p.openTime && p.closeTime ? `${p.openTime}–${p.closeTime}` : 'hours n/a'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={() => toggleVerified(p)} title="Toggle partner verification" style={chip(p.verified, 'var(--green)')}>
                    <BadgeCheck size={13} /> {p.verified ? 'Verified' : 'Mark verified'}
                  </button>
                  <select value={p.plantStatus} onChange={e => patch(p, { plantStatus: e.target.value as PlantStatus })} style={pill(p.plantStatus === 'approved' ? 'var(--green)' : p.plantStatus === 'rejected' ? 'var(--red)' : 'var(--muted)')}>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <button onClick={() => patch(p, { isActive: !p.isActive })} title="Toggle active" style={chip(p.isActive, 'var(--blue)')}>
                    <Power size={13} /> {p.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button onClick={() => patch(p, { locationVerified: !p.locationVerified })} title="Toggle location verified" style={chip(p.locationVerified, 'var(--gold)')}>
                    {p.locationVerified ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />} {p.locationVerified ? 'Pin OK' : 'Pin?'}
                  </button>
                  {p.ownerCount > 0 ? (
                    <button onClick={() => openLogins(p)} title="View and manage the logins for this plant" style={chip(true, 'var(--blue)')}>
                      <Users size={13} /> Manage logins
                    </button>
                  ) : (
                    <button onClick={() => openOwner(p)} title="Provision an owner login" style={chip(false, 'var(--blue)')}>
                      <UserPlus size={13} /> Owner login
                    </button>
                  )}
                  <button onClick={() => openEdit(p)} style={iconBtn}><Pencil size={15} /></button>
                  <button onClick={() => remove(p)} style={{ ...iconBtn, color: 'var(--red)' }}><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
          </div>
          )}
        </>
      )}

      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 14px', zIndex: 1000, overflowY: 'auto' }}>
          <form onClick={e => e.stopPropagation()} onSubmit={save} style={{ width: 'min(660px, 100%)', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>{editId != null ? 'Edit Plant' : 'Add Plant'}</h2>
              <button type="button" onClick={() => { setShowForm(false); resetExtractionState(); }} style={iconBtn}><X size={18} /></button>
            </div>

            {/* AI Document Extraction Panel */}
            <div style={{ ...softCard, marginBottom: 16, borderColor: showDocPanel ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : 'var(--line)', background: showDocPanel ? 'rgba(23,138,110,.04)' : 'var(--chip-bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={15} style={{ color: 'var(--gold)' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Extract from GST/registration document</span>
                  {autoFilled.size > 0 && (
                    <span style={{ ...badge('var(--green)'), fontSize: 10 }}>
                      <CheckCircle2 size={10} /> {autoFilled.size} field{autoFilled.size > 1 ? 's' : ''} auto-filled
                    </span>
                  )}
                </div>
                <button type="button" onClick={() => setShowDocPanel(v => !v)} style={{ ...chip(showDocPanel, 'var(--gold)'), fontSize: 12, padding: '4px 10px' }}>
                  {showDocPanel ? 'Hide' : 'Open'}
                </button>
              </div>

              {showDocPanel && (
                <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
                    Upload a photo/scan of the GST certificate, or paste the document text below. AI will extract the legal name, GST number, contact, and email automatically. Only empty fields are overwritten — verify the filled values.
                  </p>

                  {/* File upload */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={extracting}
                      style={{ ...chip(false, 'var(--blue)'), opacity: extracting ? 0.6 : 1 }}
                    >
                      <Upload size={13} /> Upload image / PDF
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>or paste text below</span>
                  </div>

                  {/* Paste text */}
                  <textarea
                    value={docText}
                    onChange={e => setDocText(e.target.value)}
                    placeholder="Paste the text content of the document here…"
                    rows={5}
                    style={{ ...input, resize: 'vertical', fontFamily: 'inherit', fontSize: 12.5 }}
                  />

                  {extractError && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, color: 'var(--red)', fontSize: 12.5 }}>
                      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {extractError}
                    </div>
                  )}
                  {extractWarning && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, color: 'var(--gold)', fontSize: 12.5 }}>
                      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {extractWarning}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      disabled={!docText.trim() || extracting}
                      onClick={() => extractDocument({ type: 'text', data: docText })}
                      style={{ ...primaryBtn, opacity: (!docText.trim() || extracting) ? 0.5 : 1, fontSize: 12.5, padding: '7px 13px' }}
                    >
                      <Sparkles size={13} /> {extracting ? 'Extracting…' : 'Extract fields'}
                    </button>
                    {(docText || extractError || extractWarning) && (
                      <button type="button" onClick={() => { setDocText(''); setExtractError(''); setExtractWarning(''); }} style={{ ...ghostBtn, fontSize: 12.5, padding: '7px 13px' }}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Plant name *"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={input} /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <AiField label="Legal / company name" aiField="legalName" autoFilled={autoFilled} onClearAi={k => setAutoFilled(s => { const n = new Set(s); n.delete(k); return n; })}>
                  <input value={form.legalName} onChange={e => { setForm(f => ({ ...f, legalName: e.target.value })); setAutoFilled(s => { const n = new Set(s); n.delete('legalName'); return n; }); }} style={input} placeholder="Printed on challans" />
                </AiField>
                <AiField label="GST number" aiField="gstNo" autoFilled={autoFilled} onClearAi={k => setAutoFilled(s => { const n = new Set(s); n.delete(k); return n; })}>
                  <div>
                    <input
                      value={form.gstNo}
                      onChange={e => { setForm(f => ({ ...f, gstNo: e.target.value.toUpperCase() })); setAutoFilled(s => { const n = new Set(s); n.delete('gstNo'); return n; }); }}
                      style={{ ...input, borderColor: form.gstNo.trim() && !isValidGst(form.gstNo) ? 'color-mix(in srgb, var(--red) 60%, transparent)' : undefined }}
                      placeholder="e.g. 29ABCDE1234F1Z5"
                      maxLength={15}
                    />
                    {form.gstNo.trim() && !isValidGst(form.gstNo) && (
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--red)', marginTop: 4 }}>
                        Invalid GST format — must be 15 characters (e.g. 29ABCDE1234F1Z5)
                      </span>
                    )}
                    {form.gstNo.trim() && isValidGst(form.gstNo) && (
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--green)', marginTop: 4 }}>✓ Valid GST format</span>
                    )}
                  </div>
                </AiField>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field label="City"><input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} style={input} /></Field>
                <AiField label="Contact number" aiField="contactNumber" autoFilled={autoFilled} onClearAi={k => setAutoFilled(s => { const n = new Set(s); n.delete(k); return n; })}>
                  <input value={form.contactNumber} onChange={e => { setForm(f => ({ ...f, contactNumber: e.target.value })); setAutoFilled(s => { const n = new Set(s); n.delete('contactNumber'); return n; }); }} style={input} />
                </AiField>
                <AiField label="Email" aiField="email" autoFilled={autoFilled} onClearAi={k => setAutoFilled(s => { const n = new Set(s); n.delete(k); return n; })}>
                  <input type="email" value={form.email} onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setAutoFilled(s => { const n = new Set(s); n.delete('email'); return n; }); }} style={input} />
                </AiField>
              </div>
              <Field label="Address"><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={input} /></Field>

              <Field label="Location (search, drop or drag a pin) *">
                <LocationPicker value={pin} onChange={p => setForm(f => ({ ...f, latitude: p.lat.toFixed(7), longitude: p.lng.toFixed(7) }))} />
              </Field>

              {dupeNearby && !dupeDismissed && (
                <div style={{ ...softCard, borderColor: 'color-mix(in srgb, var(--gold) 50%, transparent)', background: 'rgba(23,138,110,.04)', color: 'var(--gold)', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ flex: 1 }}>
                    Another verified plant (<strong style={{ color: 'var(--text)' }}>{dupeNearby.name}</strong>
                    {dupeNearby.city ? `, ${dupeNearby.city}` : ''}) is <strong style={{ color: 'var(--text)' }}>{dupeNearby.distanceKm} km</strong> away.
                    Adjust the pin if this is a different site, or continue if it's intentional.
                  </span>
                  <button type="button" onClick={() => setDupeDismissed(true)} style={{ ...iconBtn, flexShrink: 0 }} aria-label="Dismiss warning"><X size={14} /></button>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field label="Delivery radius (km)"><input type="number" min={1} value={form.deliveryRadiusKm} onChange={e => setForm(f => ({ ...f, deliveryRadiusKm: Number(e.target.value) }))} style={input} /></Field>
                <Field label="Opens"><input type="time" value={form.openTime} onChange={e => setForm(f => ({ ...f, openTime: e.target.value }))} style={input} /></Field>
                <Field label="Closes"><input type="time" value={form.closeTime} onChange={e => setForm(f => ({ ...f, closeTime: e.target.value }))} style={input} /></Field>
              </div>

              <Field label="Available grades">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ALL_GRADES.map(g => {
                    const on = form.grades.includes(g);
                    return (
                      <button type="button" key={g} onClick={() => setForm(f => ({ ...f, grades: on ? f.grades.filter(x => x !== g) : [...f.grades, g] }))} style={chip(on, 'var(--blue)')}>
                        {on && <Check size={12} />} {g}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 2 }}>
                <Field label="Status">
                  <select value={form.plantStatus} onChange={e => setForm(f => ({ ...f, plantStatus: e.target.value as PlantStatus }))} style={input}>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </Field>
                <label style={checkRow}><input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} /> Active</label>
                <label style={checkRow}><input type="checkbox" checked={form.locationVerified} onChange={e => setForm(f => ({ ...f, locationVerified: e.target.checked }))} /> Map pin verified</label>
                <label style={{ ...checkRow, color: 'var(--green)' }}><input type="checkbox" checked={form.verified} onChange={e => setForm(f => ({ ...f, verified: e.target.checked }))} /> Verified partner (visible to customers)</label>
              </div>

              {form.verified && missingVerifyFields(form).length > 0 && (
                <div style={{ ...softCard, borderColor: 'color-mix(in srgb, var(--gold) 50%, transparent)', color: 'var(--gold)', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    Missing {missingVerifyFields(form).join(', ')}. Verified plants are published to the
                    customer-facing marketplace — you'll be asked to confirm before saving.
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" onClick={() => { setShowForm(false); resetExtractionState(); }} style={ghostBtn}>Cancel</button>
              <button type="submit" disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
                <MapPin size={15} /> {saving ? 'Saving…' : editId != null ? 'Save changes' : 'Add plant'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Auto-invite notification shown after a plant is verified and invites are processed */}
      {autoInviteResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 14px', zIndex: 1100 }}>
          <div style={{ width: 'min(480px, 100%)', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} style={{ color: 'var(--green)' }} /> Plant verified
              </h2>
              <button type="button" onClick={() => setAutoInviteResult(null)} style={iconBtn}><X size={16} /></button>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--muted)' }}>
              The plant is now published to the customer-facing marketplace.{' '}
              {autoInviteResult.sent === 0 ? (
                <>No pending-invite accounts found — owners already have passwords or none are provisioned.</>
              ) : autoInviteResult.sent === 1 ? (
                <>A password-setup invite was automatically sent to <strong style={{ color: 'var(--text)' }}>1 owner</strong>.</>
              ) : (
                <>Password-setup invites were automatically sent to <strong style={{ color: 'var(--text)' }}>{autoInviteResult.sent} owners</strong>.</>
              )}
            </p>
            {autoInviteResult.links.some(l => l.inviteUrl) && (
              <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>
                  Email could not be sent — share the secure link manually:
                </p>
                {autoInviteResult.links.filter(l => l.inviteUrl).map((l, i) => (
                  <div key={i} style={{ ...softCard, padding: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{l.name} — {l.email}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input readOnly value={l.inviteUrl} onFocus={e => e.currentTarget.select()} style={{ ...input, fontSize: 11.5 }} />
                      <button type="button" onClick={() => navigator.clipboard?.writeText(l.inviteUrl!)} style={{ ...ghostBtn, padding: '6px 10px', fontSize: 12 }}>
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {autoInviteResult.errors && autoInviteResult.errors.length > 0 && (
              <div style={{ display: 'grid', gap: 8, marginBottom: 14, padding: 12, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#ef4444', fontWeight: 700 }}>
                  Invite failed for {autoInviteResult.errors.length === 1 ? '1 account' : `${autoInviteResult.errors.length} accounts`} — action required:
                </p>
                {autoInviteResult.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{e.email}</span> — {e.reason}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button type="button" onClick={() => setAutoInviteResult(null)} style={primaryBtn}>Done</button>
            </div>
          </div>
        </div>
      )}

      {ownerFor && (
        <div onClick={() => setOwnerFor(null)} style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 14px', zIndex: 1000, overflowY: 'auto' }}>
          <form onClick={e => e.stopPropagation()} onSubmit={provisionOwner} style={{ width: 'min(460px, 100%)', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={18} style={{ color: 'var(--blue)' }} /> Owner login
              </h2>
              <button type="button" onClick={() => setOwnerFor(null)} style={iconBtn}><X size={18} /></button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>
              Create a login for <strong style={{ color: 'var(--text)' }}>{ownerFor.name}</strong>. The account is scoped to this plant — it only ever sees this plant's own data.
            </p>

            {ownerDone ? (
              <>
                <div style={{ ...softCard, borderColor: 'color-mix(in srgb, var(--green) 45%, transparent)', color: 'var(--green)', fontSize: 13.5, marginBottom: 16 }}>{ownerDone}</div>
                {ownerInviteUrl && (
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Secure set-password link (single use, expires in 7 days)</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input readOnly value={ownerInviteUrl} onFocus={e => e.currentTarget.select()} style={{ ...input, fontSize: 12 }} />
                      <button type="button" onClick={() => navigator.clipboard?.writeText(ownerInviteUrl)} style={ghostBtn}>Copy</button>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => { setOwnerDone(''); setOwnerInviteUrl(''); setOwnerForm(ownerEmpty); }} style={ghostBtn}>Add another</button>
                  <button type="button" onClick={() => setOwnerFor(null)} style={primaryBtn}>Done</button>
                </div>
              </>
            ) : (
              <>
                {ownerError && <div style={{ ...softCard, borderColor: 'color-mix(in srgb, var(--red) 45%, transparent)', color: 'var(--red)', marginBottom: 14, fontSize: 13.5 }}>{ownerError}</div>}
                <div style={{ display: 'grid', gap: 12 }}>
                  <Field label="Owner name *"><input value={ownerForm.name} onChange={e => setOwnerForm(f => ({ ...f, name: e.target.value }))} style={input} /></Field>
                  <Field label="Email *"><input type="email" value={ownerForm.email} onChange={e => setOwnerForm(f => ({ ...f, email: e.target.value }))} style={input} /></Field>
                  <Field label="Access level">
                    <select value={ownerForm.role} onChange={e => setOwnerForm(f => ({ ...f, role: e.target.value as OwnerRole }))} style={input}>
                      <option value="plant_owner">Plant Owner</option>
                      <option value="admin">Owner (full plant access)</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="dispatcher">Dispatcher</option>
                      <option value="plant_operator">Plant operator</option>
                      <option value="driver">Driver</option>
                    </select>
                  </Field>

                  <div style={{ ...softCard, padding: 14 }}>
                    <label style={{ ...checkRow, alignItems: 'flex-start' }}>
                      <input type="checkbox" checked={ownerForm.setOwnPassword} onChange={e => setOwnerForm(f => ({ ...f, setOwnPassword: e.target.checked }))} style={{ marginTop: 2 }} />
                      <span>
                        Email a secure “set your password” link
                        <span style={{ display: 'block', fontWeight: 500, color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>
                          The owner sets their own password via a single-use link that expires in 7 days. Recommended.
                        </span>
                      </span>
                    </label>
                    {!ownerForm.setOwnPassword && (
                      <div style={{ marginTop: 12 }}>
                        <Field label="Temporary password * (min 6 chars)"><input type="text" value={ownerForm.password} onChange={e => setOwnerForm(f => ({ ...f, password: e.target.value }))} style={input} /></Field>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button type="button" onClick={() => setOwnerFor(null)} style={ghostBtn}>Cancel</button>
                  <button type="submit" disabled={ownerSaving} style={{ ...primaryBtn, opacity: ownerSaving ? 0.6 : 1 }}>
                    <UserPlus size={15} /> {ownerSaving ? 'Creating…' : ownerForm.setOwnPassword ? 'Create & send invite' : 'Create login'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}

      {loginsFor && (
        <div onClick={() => setLoginsFor(null)} style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 14px', zIndex: 1000, overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(540px, 100%)', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} style={{ color: 'var(--blue)' }} /> Logins
              </h2>
              <button type="button" onClick={() => setLoginsFor(null)} style={iconBtn}><X size={18} /></button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>
              Accounts that can sign in for <strong style={{ color: 'var(--text)' }}>{loginsFor.name}</strong>. Each is scoped to this plant only.
            </p>

            {loginsError && <div style={{ ...softCard, borderColor: 'color-mix(in srgb, var(--red) 45%, transparent)', color: 'var(--red)', marginBottom: 12, fontSize: 13.5 }}>{loginsError}</div>}
            {loginsNotice && <div style={{ ...softCard, borderColor: 'color-mix(in srgb, var(--green) 45%, transparent)', color: 'var(--green)', marginBottom: 12, fontSize: 13.5 }}>{loginsNotice}</div>}

            {logins == null ? (
              <div style={{ color: 'var(--muted)', padding: '14px 0', fontSize: 13.5 }}>Loading…</div>
            ) : logins.length === 0 ? (
              <div style={{ ...softCard, textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>No logins linked to this plant.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {logins.map(u => (
                  <div key={u.id} style={{ ...softCard, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', padding: 13 }}>
                    <div style={{ minWidth: 180, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>{u.name}</span>
                        <span style={badge('var(--blue)')}>{ROLE_LABELS[u.role] ?? u.role}</span>
                        <span style={badge(u.isActive ? 'var(--green)' : 'var(--muted)')}>{u.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{u.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button onClick={() => resendWelcome(u)} disabled={busyLoginId === u.id} title="Resend the welcome / invite email" style={{ ...chip(false, 'var(--gold)'), opacity: busyLoginId === u.id ? 0.6 : 1 }}>
                        <Mail size={13} /> Resend invite
                      </button>
                      <button onClick={() => toggleLoginActive(u)} disabled={busyLoginId === u.id} title={u.isActive ? 'Deactivate this login' : 'Reactivate this login'} style={{ ...chip(u.isActive, u.isActive ? 'var(--red)' : 'var(--green)'), opacity: busyLoginId === u.id ? 0.6 : 1 }}>
                        <Power size={13} /> {u.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button type="button" onClick={() => { const p = loginsFor; setLoginsFor(null); if (p) openOwner(p); }} style={ghostBtn}>
                <UserPlus size={15} /> Add login
              </button>
              <button type="button" onClick={() => setLoginsFor(null)} style={primaryBtn}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const INVITE_STATUS_COLORS: Record<InviteStatus, string> = {
  pending: 'var(--gold)',
  onboarded: 'var(--green)',
  dismissed: 'var(--muted)',
};

const PLANT_CSV_TEMPLATE = [
  'name,latitude,longitude,address,city,contactNumber,email,legalName,gstNo',
  'Sunrise Ready-Mix,19.0760,72.8777,"12 Industrial Estate, MIDC",Mumbai,9876543210,contact@sunrisermc.in,Sunrise Concrete Pvt Ltd,27ABCDE1234F1Z5',
].join('\r\n') + '\r\n';

function InvitesPanel({ invites, error, busyId, onOnboard, onSetStatus }: {
  invites: PlantInvite[] | null;
  error: string;
  busyId: number | null;
  onOnboard: (inv: PlantInvite) => void;
  onSetStatus: (inv: PlantInvite, status: InviteStatus) => void;
}) {
  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)' }}>
        Plants customers found on the live map and asked us to onboard. Each placeId is de-duplicated — repeat requests bump the count instead of piling up.
      </p>
      {error && <div style={{ ...softCard, borderColor: 'color-mix(in srgb, var(--red) 45%, transparent)', color: 'var(--red)', marginBottom: 12, fontSize: 13.5 }}>{error}</div>}
      {invites == null ? (
        <div style={{ color: 'var(--muted)', padding: 30 }}>Loading…</div>
      ) : invites.length === 0 ? (
        <div style={{ ...softCard, textAlign: 'center', color: 'var(--muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Inbox size={26} style={{ color: 'var(--muted)' }} />
          No onboarding requests yet. When a customer flags a discovered plant, it shows up here.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {invites.map(inv => {
            const busy = busyId === inv.id;
            const hasCoords = !!(inv.latitude && inv.longitude);
            return (
              <div key={inv.id} style={{ ...softCard, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 220, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{inv.name}</span>
                    <span style={badge(INVITE_STATUS_COLORS[inv.status])}>{inv.status.toUpperCase()}</span>
                    {inv.requestCount > 1 && <span style={badge('var(--blue)')}>{inv.requestCount} requests</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
                    {inv.address || 'no address'} · {inv.contactNumber || 'no contact'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                    Requested by {inv.lastRequestedByName || 'a customer'} · {new Date(inv.updatedAt).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                  {hasCoords && (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${inv.latitude},${inv.longitude}`} target="_blank" rel="noopener noreferrer" style={{ ...chip(false, 'var(--gold)'), textDecoration: 'none' }} title="View this location on Google Maps">
                      <MapPin size={13} /> Map
                    </a>
                  )}
                  <button onClick={() => onOnboard(inv)} disabled={busy} style={{ ...chip(true, 'var(--green)'), opacity: busy ? 0.6 : 1 }} title="Create a plant from this request">
                    <Plus size={13} /> Add as plant
                  </button>
                  {inv.status !== 'onboarded' && (
                    <button onClick={() => onSetStatus(inv, 'onboarded')} disabled={busy} style={{ ...chip(false, 'var(--green)'), opacity: busy ? 0.6 : 1 }} title="Mark this request as onboarded">
                      <Check size={13} /> Mark onboarded
                    </button>
                  )}
                  {inv.status !== 'dismissed' ? (
                    <button onClick={() => onSetStatus(inv, 'dismissed')} disabled={busy} style={{ ...chip(false, 'var(--red)'), opacity: busy ? 0.6 : 1 }} title="Dismiss this request">
                      <X size={13} /> Dismiss
                    </button>
                  ) : (
                    <button onClick={() => onSetStatus(inv, 'pending')} disabled={busy} style={{ ...chip(false, 'var(--gold)'), opacity: busy ? 0.6 : 1 }} title="Restore this request to the queue">
                      <Sprout size={13} /> Restore
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}

function AiField({ label, aiField, autoFilled, onClearAi, children }: {
  label: string; aiField: string; autoFilled: Set<string>;
  onClearAi: (key: string) => void; children: React.ReactNode;
}) {
  const isFilled = autoFilled.has(aiField);
  return (
    <div style={{ display: 'block' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: isFilled ? 'var(--gold)' : 'var(--muted)' }}>{label}</span>
        {isFilled && (
          <span
            title="Auto-filled by AI — verify this value"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 800, letterSpacing: '0.3px', color: 'var(--gold)', background: 'color-mix(in srgb, var(--gold) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 35%, transparent)', borderRadius: 20, padding: '1px 7px', cursor: 'default' }}>
            <Sparkles size={9} /> AI
          </span>
        )}
        {isFilled && (
          <button type="button" onClick={() => onClearAi(aiField)}
            title="Clear AI badge"
            style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', lineHeight: 1, fontSize: 10 }}>
            ×
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9,
  background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13.5,
};
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 15px', borderRadius: 10, cursor: 'pointer', fontSize: 13.5, fontWeight: 800,
  background: 'var(--gold)', color: '#1a1a1a', border: 'none',
};
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 15px', borderRadius: 10, cursor: 'pointer', fontSize: 13.5, fontWeight: 700,
  background: 'var(--chip-bg)', color: 'var(--text)', border: '1px solid var(--line)',
};
const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 9, cursor: 'pointer',
  background: 'var(--chip-bg)', color: 'var(--text)', border: '1px solid var(--line)',
};
const softCard: React.CSSProperties = { padding: 16, borderRadius: 13, border: '1px solid var(--line)', background: 'var(--chip-bg)' };
const linkBtn: React.CSSProperties = {
  padding: 0, background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--blue)', fontSize: 12, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 2,
};
const checkRow: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, color: 'var(--text)', cursor: 'pointer' };

function pill(color: string): React.CSSProperties {
  return { padding: '6px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: `color-mix(in srgb, ${color} 14%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`, cursor: 'pointer' };
}
function chip(on: boolean, color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    background: on ? `color-mix(in srgb, ${color} 16%, transparent)` : 'var(--chip-bg)',
    color: on ? color : 'var(--muted)',
    border: `1px solid ${on ? `color-mix(in srgb, ${color} 38%, transparent)` : 'var(--line)'}`,
  };
}
function badge(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, letterSpacing: '0.3px',
    color, background: `color-mix(in srgb, ${color} 16%, transparent)`, borderRadius: 20, padding: '2px 9px',
  };
}
function tabBtn(active: boolean, color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
    background: active ? `color-mix(in srgb, ${color} 16%, transparent)` : 'var(--chip-bg)',
    color: active ? color : 'var(--muted)',
    border: `1px solid ${active ? `color-mix(in srgb, ${color} 38%, transparent)` : 'var(--line)'}`,
  };
}
const countPill: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 800, background: 'var(--chip-bg)', borderRadius: 20, padding: '1px 8px', color: 'inherit',
};
const unreadDot: React.CSSProperties = {
  position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 4px',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 10.5, fontWeight: 900, lineHeight: 1, color: '#08111f',
  background: 'var(--blue)', borderRadius: 20,
  boxShadow: '0 0 0 2px var(--bg, #08111f), 0 2px 8px color-mix(in srgb, var(--blue) 55%, transparent)',
};
