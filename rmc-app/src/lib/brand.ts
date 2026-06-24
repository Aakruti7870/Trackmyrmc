import type { Challan } from './api';

// The marketplace platform's own name — used for the app shell (login, sidebar,
// kiosk, registration). This is the platform brand, NOT a plant brand: any
// concrete document (challan, receipt) must instead be branded by the issuing
// plant via the helpers below.
export const PLATFORM_NAME = 'CONCRETE KING';
export const PLATFORM_TAGLINE = 'RMC Marketplace & Plant Management';

// Support contacts shown on auth screens and legal pages.
export const SUPPORT_EMAIL = 'support@goldetech.com';
export const SUPPORT_PHONE = '+91 74982 86760';
export const SUPPORT_WHATSAPP_URL = 'https://wa.me/917498286760';

// The plant identity to print on a challan/receipt. Falls back gracefully when a
// field is absent so a legacy/unbranded challan still renders something sensible,
// but never substitutes a hardcoded company name.
export interface PlantIdentity {
  name: string;
  legalName: string;
  code: string | null;
  address: string;
  city: string;
  contact: string;
  gstNo: string | null;
  email: string | null;
}

export function plantIdentity(c: Pick<Challan,
  'plantName' | 'plantLegalName' | 'plantCode' | 'plantAddress' | 'plantCity' | 'plantContact' | 'plantGstNo' | 'plantEmail'>): PlantIdentity {
  const name = c.plantName?.trim() || 'Ready-Mix Concrete Plant';
  return {
    name,
    legalName: c.plantLegalName?.trim() || name,
    code: c.plantCode?.trim() || null,
    address: c.plantAddress?.trim() || '',
    city: c.plantCity?.trim() || '',
    contact: c.plantContact?.trim() || '',
    gstNo: c.plantGstNo?.trim() || null,
    email: c.plantEmail?.trim() || null,
  };
}
