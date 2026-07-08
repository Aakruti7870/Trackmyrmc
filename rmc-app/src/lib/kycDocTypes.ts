// Shared KYC document type catalogue (mirrors the server's DOC_TYPES enum).
export const DOC_TYPES = [
  { value: 'gst', label: 'GST Certificate' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'aadhaar', label: 'Aadhaar (masked)' },
  { value: 'driving_license', label: 'Driving Licence' },
  { value: 'rc', label: 'Vehicle RC' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'puc', label: 'PUC Certificate' },
  { value: 'fitness', label: 'Fitness Certificate' },
  { value: 'photo', label: 'Photograph' },
  { value: 'other', label: 'Other Document' },
] as const;

export const DOC_LABEL: Record<string, string> = Object.fromEntries(DOC_TYPES.map(d => [d.value, d.label]));
