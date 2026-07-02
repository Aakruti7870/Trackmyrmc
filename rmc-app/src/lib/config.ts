import { createContext, useContext } from 'react';
import type { SocialLinks } from './api';

export interface AppConfig {
  appVersion: string;
  rolePermissionOverrides: Partial<Record<string, string[]>>;
  socialLinks?: SocialLinks;
}

// Fallback links used until the bootstrap config loads (or if it fails) —
// mirrors DEFAULT_SOCIAL_LINKS on the server.
export const DEFAULT_SOCIAL_LINKS: SocialLinks = {
  youtube: 'https://youtube.com/@trackmyrmc?si=PpDzLHQX72dqjmC9',
  instagram: 'https://www.instagram.com/gold_e_tech?igsh=MXd1eGJoMzNyOHVzNQ==',
  facebook: 'https://www.facebook.com/profile.php?id=61590998875994',
  whatsapp: 'https://wa.me/qr/FXY47PIBVMQFA1',
  playStore: '',
};

export interface ConfigCtx {
  appVersion: string;
  socialLinks: SocialLinks;
  loaded: boolean;
}

export const ConfigContext = createContext<ConfigCtx>({
  appVersion: '',
  socialLinks: DEFAULT_SOCIAL_LINKS,
  loaded: false,
});

export function useConfig() {
  return useContext(ConfigContext);
}
