import { useState, useMemo, type ElementType, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { canAccess } from '@/lib/permissions';
import {
  Sparkles, Calculator, HardHat, Handshake, PackageSearch, Cctv,
  Wrench, LifeBuoy, Briefcase, X, Send, MapPin, ChevronRight, Info,
  Fuel, Truck, Wallet,
} from 'lucide-react';
import VolumeCalc from '@/components/VolumeCalc';

// ---------------------------------------------------------------------------
// Premium Dark-Green + Gold palette (matches customer Home). Hard-coded so the
// NEW menu looks identical in Day and Night — it is an overlay, not themed.
// ---------------------------------------------------------------------------
const CREAM = '#F8F5EC';
const DGREEN = '#0B3D2E';
const DGREEN_DEEP = '#06281d';
const DGREEN_HI = '#14563f';
const GOLD = '#D6A936';
const GOLD_LIGHT = '#F4D27A';
const GOLD_TEXT = '#8a6a14';
const CARD_BG = '#FFFFFF';
const TXT = '#102820';
const TXT_MUTED = '#5c6f66';
const LINE_CREAM = '#e7e2d3';
const RED = '#ef4444';

const WHATSAPP_NUMBER = '917498286760';

// --- WhatsApp message model -------------------------------------------------
// Every form field maps to one fixed slot in the enquiry message, so all nine
// widgets produce the same clean, readable WhatsApp format.
type Slot =
  | 'option' | 'nameCompany' | 'gst' | 'address' | 'email' | 'mobile'
  | 'requirement' | 'appointment' | 'role' | 'experience' | 'joining' | 'extra';

const SLOT_LABEL: Record<Slot, string> = {
  option: 'Selected Option',
  nameCompany: 'Name / Company',
  gst: 'GST',
  address: 'Address / Location',
  email: 'Email',
  mobile: 'Mobile',
  requirement: 'Requirement',
  appointment: 'Schedule Appointment',
  role: 'Role',
  experience: 'Experience',
  joining: 'Joining',
  extra: 'Extra Details',
};

const SLOT_ORDER: Slot[] = [
  'option', 'nameCompany', 'gst', 'address', 'email', 'mobile',
  'requirement', 'appointment', 'role', 'experience', 'joining', 'extra',
];

type FieldType = 'text' | 'tel' | 'email' | 'textarea' | 'select' | 'segmented' | 'date' | 'file';

type Field = {
  key: string;
  label: string;
  type: FieldType;
  slot: Slot;
  options?: string[];
  required?: boolean;
  placeholder?: string;
  note?: string;
  optional?: boolean;             // renders "(optional)" hint
  extraLabel?: string;            // label used inside the "Extra Details" slot
  showIf?: (v: Record<string, string>) => boolean;
};

type WidgetKind = 'info' | 'calculator' | 'form' | 'nav';

type WidgetDef = {
  id: string;
  title: string;
  icon: ElementType;
  kind: WidgetKind;
  badge?: string;
  subtitle?: string;
  marketing?: string;
  cta?: string;
  note?: string;
  navTo?: string;                 // 'nav' widgets route straight here, no sheet
  infoItems?: { label: string; icon: ReactNode }[];
  fields?: Field[];
};

// --- USER (client) widget set ----------------------------------------------
const USER_WIDGETS: WidgetDef[] = [
  {
    id: 'next-version',
    title: 'Next Version',
    icon: Sparkles,
    kind: 'info',
    badge: 'V.1.16',
    subtitle: 'Upcoming services already lined up inside the app.',
    infoItems: [
      { label: 'Hire Land Surveyor', icon: <MapPin className="h-4 w-4" /> },
      { label: 'Hire RCC Contractor', icon: <HardHat className="h-4 w-4" /> },
      { label: 'Hire Labour Contractor', icon: <HardHat className="h-4 w-4" /> },
      { label: 'Hire Billing Engineer', icon: <Briefcase className="h-4 w-4" /> },
      { label: 'Become a Partner & grow with us', icon: <Handshake className="h-4 w-4" /> },
    ],
  },
  {
    id: 'calculator',
    title: 'Concrete Calculator',
    icon: Calculator,
    kind: 'calculator',
    subtitle: 'Estimate the concrete volume you should order, with a 5% wastage allowance.',
  },
  {
    id: 'hire-staff',
    title: 'Hire Staff / Labour',
    icon: HardHat,
    kind: 'form',
    subtitle: 'Tell us who you need — we will connect you with the right people.',
    cta: 'Send Enquiry on WhatsApp',
    fields: [
      { key: 'option', label: 'What do you need?', type: 'select', slot: 'option', required: true,
        options: ['Hire RCC Contractor', 'Hire Labour Contractor', 'Hire Land Surveyor', 'Hire Billing Engineer Freelancer'] },
      { key: 'name', label: 'Your Name', type: 'text', slot: 'nameCompany', required: true, placeholder: 'Full name' },
      { key: 'mobile', label: 'Mobile Number', type: 'tel', slot: 'mobile', required: true, placeholder: '10-digit mobile' },
      { key: 'location', label: 'Work Location', type: 'text', slot: 'address', placeholder: 'City / area' },
      { key: 'requirement', label: 'Requirement Details', type: 'textarea', slot: 'requirement', placeholder: 'Briefly describe what you need' },
    ],
  },
  {
    id: 'partner',
    title: 'Be a Partner',
    icon: Handshake,
    kind: 'form',
    marketing: 'Connect with us with zero charges and grow your business.',
    cta: "Let's Be A Partner",
    fields: [
      { key: 'option', label: 'Category', type: 'select', slot: 'option', required: true,
        options: ['Civil Labour Supplier', 'Contractor', 'Land Surveyor', 'RCC Contractor', 'Labour Contractor', 'Billing Engineer', 'Shuttering Contractor', 'Material Supplier', 'Other'] },
      { key: 'name', label: 'Name', type: 'text', slot: 'nameCompany', required: true, placeholder: 'Your name' },
      { key: 'location', label: 'Preferred Work Location', type: 'text', slot: 'address', placeholder: 'City / area' },
      { key: 'mobile', label: 'Mobile Number', type: 'tel', slot: 'mobile', required: true, placeholder: '10-digit mobile' },
      { key: 'iam', label: 'I Am', type: 'segmented', slot: 'role', options: ['Professional', 'Business', 'Freelancer'] },
    ],
  },
];

// --- OWNER / ADMIN / PLANT STAFF widget set --------------------------------
const STAFF_WIDGETS: WidgetDef[] = [
  {
    id: 'find-supplier',
    title: 'Find Supplier',
    icon: PackageSearch,
    kind: 'form',
    note: 'Navi Mumbai area for now.',
    cta: 'Send Enquiry on WhatsApp',
    fields: [
      { key: 'option', label: 'Supplier Type', type: 'select', slot: 'option', required: true,
        options: ['Cement Supplier', 'Flyash Supplier', 'Admixture Supplier', 'Aggregate Supplier'] },
      { key: 'company', label: 'Company Name', type: 'text', slot: 'nameCompany', required: true, placeholder: 'Company name' },
      { key: 'gst', label: 'GST', type: 'text', slot: 'gst', placeholder: 'GST number' },
      { key: 'address', label: 'Address', type: 'text', slot: 'address', placeholder: 'Address' },
      { key: 'email', label: 'Gmail', type: 'email', slot: 'email', placeholder: 'name@gmail.com' },
      { key: 'mobile', label: 'Mobile Number', type: 'tel', slot: 'mobile', required: true, placeholder: '10-digit mobile' },
      { key: 'appointment', label: 'Schedule Appointment', type: 'date', slot: 'appointment' },
    ],
  },
  {
    id: 'third-eye',
    title: '3rd Eye System',
    icon: Cctv,
    kind: 'form',
    subtitle: 'Surveillance, tracking & monitoring systems for your plant.',
    cta: 'Send Enquiry on WhatsApp',
    fields: [
      { key: 'option', label: 'System Type', type: 'select', slot: 'option', required: true,
        options: ['CCTV', 'GPS', 'Diesel IoT System', 'WiFi Router', 'Dongle', 'Halogens'] },
      { key: 'company', label: 'Company Name', type: 'text', slot: 'nameCompany', required: true, placeholder: 'Company name' },
      { key: 'gst', label: 'GST', type: 'text', slot: 'gst', placeholder: 'GST number' },
      { key: 'address', label: 'Address', type: 'text', slot: 'address', placeholder: 'Address' },
      { key: 'email', label: 'Gmail', type: 'email', slot: 'email', placeholder: 'name@gmail.com' },
      { key: 'mobile', label: 'Mobile Number', type: 'tel', slot: 'mobile', required: true, placeholder: '10-digit mobile' },
      { key: 'appointment', label: 'Schedule Appointment', type: 'date', slot: 'appointment' },
    ],
  },
  {
    id: 'plant-accessories',
    title: 'Plant Accessories',
    icon: Wrench,
    kind: 'form',
    subtitle: 'Source spares & accessories for your batching plant.',
    cta: 'Send Enquiry on WhatsApp',
    fields: [
      { key: 'option', label: 'Accessory', type: 'select', slot: 'option', required: true,
        options: ['Silo', 'Belt', 'Compressor', 'Lab Material'] },
      { key: 'company', label: 'Company Name', type: 'text', slot: 'nameCompany', required: true, placeholder: 'Company name' },
      { key: 'gst', label: 'GST', type: 'text', slot: 'gst', placeholder: 'GST number' },
      { key: 'email', label: 'Mail ID', type: 'email', slot: 'email', placeholder: 'name@email.com' },
      { key: 'mobile', label: 'Mobile', type: 'tel', slot: 'mobile', required: true, placeholder: '10-digit mobile' },
      { key: 'location', label: 'Location', type: 'text', slot: 'address', placeholder: 'City / area' },
      { key: 'requirement', label: 'Requirement Within', type: 'select', slot: 'requirement',
        options: ['Immediate', '15 Days', '30 Days', '45 Days'] },
    ],
  },
  {
    id: 'need-help',
    title: 'Need Help In',
    icon: LifeBuoy,
    kind: 'form',
    subtitle: 'Get support for plant work, fabrication, labour and more.',
    cta: 'Send Enquiry on WhatsApp',
    fields: [
      { key: 'option', label: 'Help Needed In', type: 'select', slot: 'option', required: true,
        options: ['RMC Plant Fabrication Work', 'Plant RCC Work', 'Labour Contractor', 'TM on Rent Monthly Basis', 'Driver'] },
      { key: 'name', label: 'Name', type: 'text', slot: 'nameCompany', required: true, placeholder: 'Your name' },
      { key: 'company', label: 'Company Name', type: 'text', slot: 'extra', extraLabel: 'Company', placeholder: 'Company name' },
      { key: 'address', label: 'Address', type: 'text', slot: 'address', placeholder: 'Address' },
      { key: 'mobile', label: 'Mobile Number', type: 'tel', slot: 'mobile', required: true, placeholder: '10-digit mobile' },
      { key: 'requirement', label: 'Requirement Details', type: 'textarea', slot: 'requirement', placeholder: 'Briefly describe what you need' },
    ],
  },
  {
    id: 'hire-me',
    title: 'Hire Me !!',
    icon: Briefcase,
    kind: 'form',
    subtitle: 'Join India’s Growing RMC Workforce',
    cta: 'Send Enquiry on WhatsApp',
    fields: [
      { key: 'name', label: 'Full Name', type: 'text', slot: 'nameCompany', required: true, placeholder: 'Full name' },
      { key: 'email', label: 'Email ID', type: 'email', slot: 'email', placeholder: 'name@email.com' },
      { key: 'mobile', label: 'Mobile Number', type: 'tel', slot: 'mobile', required: true, placeholder: '10-digit mobile' },
      { key: 'address', label: 'Address / Current Location', type: 'text', slot: 'address', placeholder: 'City / area' },
      { key: 'option', label: 'Job Role', type: 'select', slot: 'role', required: true,
        options: ['Quality Engineer', 'Plant Engineer', 'Plant Operator', 'Transit Mixer Driver', 'TM Helper', 'Plant Helper', 'Belt Operator', 'JCB Operator', 'Store Keeper', 'Dispatch Executive', 'Supervisor', 'Batcher', 'Electrician', 'Mechanical Technician', 'Welder / Fabricator', 'Pump Operator', 'Fleet Coordinator', 'Accountant', 'Safety Officer', 'Other'] },
      { key: 'experience', label: 'Years of Experience', type: 'text', slot: 'experience', placeholder: 'e.g. 5 years' },
      { key: 'currentSalary', label: 'Current Salary', type: 'text', slot: 'extra', extraLabel: 'Current Salary', placeholder: '₹ / month' },
      { key: 'expectedSalary', label: 'Expected Salary', type: 'text', slot: 'extra', extraLabel: 'Expected Salary', placeholder: '₹ / month' },
      { key: 'joining', label: 'Joining Availability', type: 'select', slot: 'joining',
        options: ['Immediate', '15 Days', '30 Days', '60 Days'] },
      { key: 'resume', label: 'Upload Resume', type: 'file', slot: 'extra', extraLabel: 'Resume' },
      { key: 'license', label: 'Upload Driving License', type: 'file', slot: 'extra', extraLabel: 'Driving License',
        showIf: v => v.option === 'Transit Mixer Driver' },
      { key: 'certs', label: 'Upload Certificates', type: 'file', slot: 'extra', extraLabel: 'Certificates', optional: true },
    ],
  },
];

// --- DRIVER "Need Help" widget set -----------------------------------------
// Emergency SOS + Start/End Shift stay permanently visible on the driver Home;
// the NEW menu carries the on-road help set (Mechanic, Petrol Pump, Towing Van)
// plus a direct shortcut to Expenses.
const DRIVER_WIDGETS: WidgetDef[] = [
  {
    id: 'driver-mechanic',
    title: 'Mechanic',
    icon: Wrench,
    kind: 'form',
    subtitle: 'Breakdown on the road? Get a mechanic to your location.',
    cta: 'Send Enquiry on WhatsApp',
    fields: [
      { key: 'option', label: 'Type of Help', type: 'select', slot: 'option', required: true,
        options: ['Engine Breakdown', 'Tyre / Puncture', 'Hydraulic / Drum', 'Electrical', 'Brake', 'Other'] },
      { key: 'name', label: 'Your Name', type: 'text', slot: 'nameCompany', placeholder: 'Full name' },
      { key: 'vehicle', label: 'Vehicle Number', type: 'text', slot: 'extra', extraLabel: 'Vehicle', placeholder: 'e.g. MH04 AB 1234' },
      { key: 'mobile', label: 'Mobile Number', type: 'tel', slot: 'mobile', required: true, placeholder: '10-digit mobile' },
      { key: 'location', label: 'Current Location', type: 'text', slot: 'address', required: true, placeholder: 'Where are you now?' },
      { key: 'requirement', label: 'Problem Details', type: 'textarea', slot: 'requirement', placeholder: 'Briefly describe the issue' },
    ],
  },
  {
    id: 'driver-petrol',
    title: 'Petrol Pump',
    icon: Fuel,
    kind: 'form',
    subtitle: 'Need fuel or ran dry? Request a fuel delivery.',
    cta: 'Send Enquiry on WhatsApp',
    fields: [
      { key: 'option', label: 'Fuel Type', type: 'select', slot: 'option', required: true,
        options: ['Diesel', 'Petrol', 'AdBlue / DEF'] },
      { key: 'vehicle', label: 'Vehicle Number', type: 'text', slot: 'extra', extraLabel: 'Vehicle', placeholder: 'e.g. MH04 AB 1234' },
      { key: 'mobile', label: 'Mobile Number', type: 'tel', slot: 'mobile', required: true, placeholder: '10-digit mobile' },
      { key: 'location', label: 'Current Location', type: 'text', slot: 'address', required: true, placeholder: 'Where are you now?' },
      { key: 'requirement', label: 'Quantity / Details', type: 'textarea', slot: 'requirement', placeholder: 'e.g. 20 litres diesel' },
    ],
  },
  {
    id: 'driver-towing',
    title: 'Towing Van',
    icon: Truck,
    kind: 'form',
    subtitle: 'Vehicle stuck? Call a towing van to the spot.',
    cta: 'Send Enquiry on WhatsApp',
    fields: [
      { key: 'option', label: 'Vehicle Type', type: 'select', slot: 'option', required: true,
        options: ['Transit Mixer', 'Truck', 'Loader', 'Other'] },
      { key: 'name', label: 'Your Name', type: 'text', slot: 'nameCompany', placeholder: 'Full name' },
      { key: 'vehicle', label: 'Vehicle Number', type: 'text', slot: 'extra', extraLabel: 'Vehicle', placeholder: 'e.g. MH04 AB 1234' },
      { key: 'mobile', label: 'Mobile Number', type: 'tel', slot: 'mobile', required: true, placeholder: '10-digit mobile' },
      { key: 'location', label: 'Breakdown Location', type: 'text', slot: 'address', required: true, placeholder: 'Where are you now?' },
      { key: 'requirement', label: 'Details', type: 'textarea', slot: 'requirement', placeholder: 'Briefly describe the situation' },
    ],
  },
  {
    id: 'driver-expenses',
    title: 'Expenses',
    icon: Wallet,
    kind: 'nav',
    navTo: '/expenses',
    subtitle: 'Log fuel, toll and other trip expenses.',
  },
];

// Roles that see the USER widget set. plant_owner / admin / staff share the
// STAFF set; the driver gets a dedicated on-road "Need Help" set. 'nav' widgets
// route into real app routes, so they honour the same role-gating as the
// bottom-nav (a route hidden by a role override must not surface here either).
function widgetsFor(role: string): WidgetDef[] {
  const base =
    role === 'client' ? USER_WIDGETS :
    role === 'driver' ? DRIVER_WIDGETS :
    STAFF_WIDGETS;
  return base.filter((w) => w.kind !== 'nav' || !w.navTo || canAccess(role, w.navTo));
}

// --- WhatsApp message builder ----------------------------------------------
function buildMessage(widget: WidgetDef, values: Record<string, string>): string {
  // Collect values per slot; "extra" accumulates several labelled parts.
  const bySlot: Partial<Record<Slot, string>> = {};
  const extras: string[] = [];
  for (const f of widget.fields || []) {
    if (f.showIf && !f.showIf(values)) continue;
    const val = (values[f.key] || '').trim();
    if (!val) continue;
    if (f.slot === 'extra') {
      extras.push(`${f.extraLabel || f.label}: ${val}`);
    } else {
      bySlot[f.slot] = bySlot[f.slot] ? `${bySlot[f.slot]}, ${val}` : val;
    }
  }
  if (extras.length) bySlot.extra = extras.join(' | ');

  const out: string[] = ['TrackMyRMC Enquiry', `Widget Name: ${widget.title}`];
  for (const slot of SLOT_ORDER) {
    const v = bySlot[slot];
    if (v) out.push(`${SLOT_LABEL[slot]}: ${v}`);
  }
  return out.join('\n');
}

// --- Small field renderer ---------------------------------------------------
function FieldInput({ field, value, error, onChange }: {
  field: Field; value: string; error?: string; onChange: (v: string) => void;
}) {
  const base = 'w-full rounded-xl border px-3 py-2.5 text-[14px] font-semibold outline-none';
  const style = { borderColor: error ? RED : LINE_CREAM, background: '#fbf8ef', color: DGREEN } as const;
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-[12px] font-bold" style={{ color: DGREEN }}>{field.label}</span>
        {field.required && <span style={{ color: RED }}>*</span>}
        {field.optional && <span className="text-[11px] font-medium" style={{ color: TXT_MUTED }}>(optional)</span>}
      </div>
      {field.type === 'textarea' && (
        <textarea rows={3} value={value} placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)} className={`mt-1 ${base}`} style={style} />
      )}
      {field.type === 'select' && (
        <select value={value} onChange={e => onChange(e.target.value)} className={`mt-1 ${base}`} style={style}>
          <option value="">Select…</option>
          {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {field.type === 'segmented' && (
        <div className="mt-1 flex gap-2">
          {field.options?.map(o => {
            const on = value === o;
            return (
              <button key={o} type="button" onClick={() => onChange(on ? '' : o)}
                className="flex-1 rounded-xl border px-2 py-2 text-[12px] font-bold active:scale-[.98]"
                style={{
                  borderColor: on ? DGREEN : LINE_CREAM,
                  background: on ? DGREEN : '#fbf8ef',
                  color: on ? '#fff' : DGREEN,
                }}>
                {o}
              </button>
            );
          })}
        </div>
      )}
      {field.type === 'file' && (
        <label className="mt-1 flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5"
          style={{ borderColor: LINE_CREAM, background: '#fbf8ef' }}>
          <span className="truncate text-[13px] font-semibold" style={{ color: value ? DGREEN : TXT_MUTED }}>
            {value || 'Choose file'}
          </span>
          <span className="ml-2 shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold"
            style={{ background: 'rgba(214,169,54,0.18)', color: GOLD_TEXT }}>Browse</span>
          <input type="file" className="hidden"
            onChange={e => onChange(e.target.files?.[0]?.name || '')} />
        </label>
      )}
      {(field.type === 'text' || field.type === 'tel' || field.type === 'email' || field.type === 'date') && (
        <input
          type={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : field.type === 'date' ? 'date' : 'text'}
          inputMode={field.type === 'tel' ? 'tel' : undefined}
          value={value} placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)} className={`mt-1 ${base}`} style={style} />
      )}
      {error && <p className="mt-1 text-[11px] font-semibold" style={{ color: RED }}>{error}</p>}
    </div>
  );
}

// --- The form body inside the bottom sheet ---------------------------------
function WidgetForm({ widget, onSent }: { widget: WidgetDef; onSent: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState('');

  const visibleFields = (widget.fields || []).filter(f => !f.showIf || f.showIf(values));

  const set = (key: string, v: string) => {
    setValues(prev => ({ ...prev, [key]: v }));
    setErrors(prev => (prev[key] ? { ...prev, [key]: '' } : prev));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    for (const f of visibleFields) {
      const val = (values[f.key] || '').trim();
      if (f.required && !val) {
        if (f.type === 'select') errs[f.key] = `Please select ${f.label.toLowerCase()}.`;
        else if (f.slot === 'mobile') errs[f.key] = 'Mobile number is required.';
        else errs[f.key] = `${f.label} is required.`;
      } else if (val && f.slot === 'mobile' && val.replace(/\D/g, '').length < 10) {
        errs[f.key] = 'Enter a valid 10-digit mobile number.';
      } else if (val && f.type === 'email' && !/^\S+@\S+\.\S+$/.test(val)) {
        errs[f.key] = 'Enter a valid email address.';
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      setBanner('Please fill the highlighted fields before sending.');
      return false;
    }
    setBanner('');
    return true;
  };

  const submit = () => {
    if (!validate()) return;
    const msg = buildMessage(widget, values);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onSent();
  };

  return (
    <div className="mt-4">
      {widget.marketing && (
        <div className="mb-3 rounded-2xl p-3.5 text-[13px] font-bold leading-snug"
          style={{ background: `linear-gradient(135deg, ${DGREEN} 0%, ${DGREEN_HI} 100%)`, color: GOLD_LIGHT }}>
          {widget.marketing}
        </div>
      )}
      {widget.note && (
        <div className="mb-3 flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold"
          style={{ background: 'rgba(214,169,54,0.15)', color: GOLD_TEXT }}>
          <Info className="h-3.5 w-3.5" /> {widget.note}
        </div>
      )}
      {banner && (
        <div className="mb-3 rounded-xl px-3 py-2 text-[12px] font-semibold"
          style={{ background: 'rgba(239,68,68,0.12)', color: RED }}>
          {banner}
        </div>
      )}
      <div className="space-y-3">
        {visibleFields.map(f => (
          <FieldInput key={f.key} field={f} value={values[f.key] || ''} error={errors[f.key]} onChange={v => set(f.key, v)} />
        ))}
      </div>
      <button onClick={submit}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[14px] font-extrabold active:scale-[.98]"
        style={{
          background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`,
          color: DGREEN, boxShadow: '0 6px 18px rgba(214,169,54,0.35)', transition: 'transform .1s ease',
        }}>
        <Send className="h-4 w-4" strokeWidth={2.6} /> {widget.cta || 'Send Enquiry on WhatsApp'}
      </button>
      <p className="mt-2 text-center text-[11px]" style={{ color: TXT_MUTED }}>
        Opens WhatsApp with your enquiry ready to send.
      </p>
    </div>
  );
}

// --- Bottom sheet shell -----------------------------------------------------
function Sheet({ widget, onClose }: { widget: WidgetDef; onClose: () => void }) {
  const [, navigate] = useLocation();
  return (
    <>
      <div className="fixed inset-0" style={{ zIndex: 90, background: 'rgba(6,40,29,0.55)' }} onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={widget.title}
        className="fixed left-1/2 bottom-0 w-full max-w-[420px] -translate-x-1/2 rounded-t-3xl px-5 pt-3"
        style={{
          zIndex: 95, background: CARD_BG, color: TXT,
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          maxHeight: '86vh', overflowY: 'auto',
          animation: 'nwmSheetUp .28s cubic-bezier(.4,0,.2,1)',
          boxShadow: '0 -18px 50px rgba(6,40,29,0.35)',
        }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: LINE_CREAM }} />
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'rgba(214,169,54,0.16)', color: DGREEN }}>
              <widget.icon className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[17px] font-extrabold leading-tight" style={{ color: DGREEN }}>{widget.title}</h3>
                {widget.badge && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                    style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: DGREEN }}>
                    {widget.badge}
                  </span>
                )}
              </div>
              {widget.subtitle && <p className="text-[11.5px] font-medium" style={{ color: TXT_MUTED }}>{widget.subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: CREAM, color: DGREEN, border: `1px solid ${LINE_CREAM}` }}>
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        {widget.kind === 'info' && (
          <div className="mt-4">
            <div className="space-y-2">
              {widget.infoItems?.map(it => (
                <div key={it.label} className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                  style={{ borderColor: LINE_CREAM, background: '#fbf8ef' }}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: 'rgba(214,169,54,0.16)', color: DGREEN }}>{it.icon}</span>
                  <span className="text-[13px] font-semibold" style={{ color: DGREEN }}>{it.label}</span>
                </div>
              ))}
            </div>
            <button onClick={onClose}
              className="mt-5 w-full rounded-2xl py-3 text-[14px] font-extrabold active:scale-[.98]"
              style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`, color: DGREEN, boxShadow: '0 6px 18px rgba(214,169,54,0.35)' }}>
              Got it
            </button>
          </div>
        )}

        {widget.kind === 'calculator' && (
          <div className="mt-1">
            <VolumeCalc />
            <button onClick={() => { onClose(); navigate('/nearby-plants'); }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[14px] font-extrabold active:scale-[.98]"
              style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`, color: DGREEN, boxShadow: '0 6px 18px rgba(214,169,54,0.35)' }}>
              Find Plants & Place Order <ChevronRight className="h-4 w-4" strokeWidth={3} />
            </button>
          </div>
        )}

        {widget.kind === 'form' && <WidgetForm widget={widget} onSent={onClose} />}
      </div>
    </>
  );
}

// --- Arc math ---------------------------------------------------------------
// 75% of a half-circle = 135° span, centred on straight-up, so widgets fan
// out evenly from the NEW button in a clean arc.
const SPAN = 135;
const RADIUS = 118;
const CIRCLE = 56;

function arcPositions(n: number): { x: number; y: number }[] {
  const start = -SPAN / 2;
  const step = n > 1 ? SPAN / (n - 1) : 0;
  return Array.from({ length: n }, (_, i) => {
    const deg = start + step * i;
    const rad = (deg * Math.PI) / 180;
    return { x: RADIUS * Math.sin(rad), y: RADIUS * Math.cos(rad) };
  });
}

// --- Public component -------------------------------------------------------
export default function NewWidgetMenu({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<WidgetDef | null>(null);
  const widgets = useMemo(() => widgetsFor(role), [role]);
  const positions = useMemo(() => arcPositions(widgets.length), [widgets.length]);

  const pick = (w: WidgetDef) => {
    setOpen(false);
    if (w.kind === 'nav' && w.navTo) { onNavigate?.(); navigate(w.navTo); return; }
    setActive(w);
  };
  const closeAll = () => { setOpen(false); setActive(null); };

  return (
    <>
      <style>{`
        @keyframes nwmSheetUp { from { transform: translate(-50%, 100%); } to { transform: translate(-50%, 0); } }
        @keyframes nwmGlow {
          0%,100% { box-shadow: 0 0 0 0 rgba(214,169,54,0.55), 0 8px 20px rgba(11,61,46,0.35); }
          50% { box-shadow: 0 0 0 8px rgba(214,169,54,0), 0 8px 26px rgba(11,61,46,0.45); }
        }
        .nwm-new-btn { animation: nwmGlow 1.8s ease-in-out infinite; }
        @keyframes nwmPop { from { opacity: 0; transform: translate(-50%, 12px) scale(.5); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
      `}</style>

      {/* Center NEW button that slots into the bottom nav */}
      <div className="flex flex-col items-center" style={{ transform: 'translateY(-10px)' }}>
        <button
          onClick={() => setOpen(o => !o)}
          className="nwm-new-btn flex h-14 w-14 items-center justify-center rounded-full text-[13px] font-extrabold tracking-wide text-white"
          style={{ background: `linear-gradient(135deg, ${DGREEN_DEEP} 0%, ${DGREEN} 55%, ${DGREEN_HI} 100%)`, border: `2px solid ${GOLD}` }}
          aria-label="Open new services menu"
        >
          NEW
        </button>
        <span className="mt-1 text-[10px] font-bold" style={{ color: GOLD_TEXT }}>NEW</span>
      </div>

      {/* Arc overlay */}
      {open && (
        <>
          <div
            className="fixed inset-0"
            style={{ zIndex: 80, background: 'rgba(6,40,29,0.45)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed left-1/2 -translate-x-1/2"
            style={{
              zIndex: 82,
              bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
              width: 'min(100vw, 420px)',
              height: RADIUS + CIRCLE + 30,
              pointerEvents: 'none',
            }}
          >
            {widgets.map((w, i) => {
              const p = positions[i];
              return (
                <button
                  key={w.id}
                  onClick={() => pick(w)}
                  className="absolute flex flex-col items-center"
                  style={{
                    left: `calc(50% + ${p.x}px)`,
                    bottom: p.y,
                    transform: 'translate(-50%, 0)',
                    pointerEvents: 'auto',
                    animation: 'nwmPop .32s cubic-bezier(.34,1.56,.64,1) both',
                    animationDelay: `${i * 45}ms`,
                  }}
                  aria-label={w.title}
                >
                  <span
                    className="flex items-center justify-center rounded-full text-white"
                    style={{
                      height: CIRCLE, width: CIRCLE,
                      background: `linear-gradient(135deg, ${DGREEN_DEEP} 0%, ${DGREEN} 60%, ${DGREEN_HI} 100%)`,
                      border: `2px solid ${GOLD}`,
                      boxShadow: '0 6px 16px rgba(6,40,29,0.4)',
                    }}
                  >
                    <w.icon className="h-6 w-6" strokeWidth={2} style={{ color: GOLD_LIGHT }} />
                  </span>
                  <span
                    className="mt-1 max-w-[74px] text-center text-[10px] font-bold leading-tight"
                    style={{ color: '#fff', textShadow: '0 1px 3px rgba(6,40,29,0.9)' }}
                  >
                    {w.title}
                  </span>
                </button>
              );
            })}
          </div>
          {/* NEW button echo at the pivot doubles as a close affordance */}
          <div
            className="fixed left-1/2 -translate-x-1/2 flex flex-col items-center"
            style={{ zIndex: 82, bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
          >
            <button
              onClick={() => setOpen(false)}
              className="flex h-14 w-14 items-center justify-center rounded-full text-[13px] font-extrabold text-white active:scale-95"
              style={{ background: `linear-gradient(135deg, ${DGREEN_DEEP} 0%, ${DGREEN} 55%, ${DGREEN_HI} 100%)`, border: `2px solid ${GOLD}`, boxShadow: '0 8px 24px rgba(6,40,29,0.5)' }}
              aria-label="Close menu"
            >
              <X className="h-6 w-6" strokeWidth={2.6} style={{ color: GOLD_LIGHT }} />
            </button>
          </div>
        </>
      )}

      {/* Detail bottom sheet */}
      {active && <Sheet widget={active} onClose={() => { onNavigate?.(); closeAll(); }} />}
    </>
  );
}
