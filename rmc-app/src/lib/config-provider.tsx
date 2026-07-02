import { useState, useEffect, type ReactNode } from 'react';
import { api, type AppConfig, type SocialLinks } from './api';
import { ConfigContext, DEFAULT_SOCIAL_LINKS } from './config';
import { setPermissionOverrides } from './permissions';

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [appVersion, setAppVersion] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(DEFAULT_SOCIAL_LINKS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<AppConfig>('/config')
      .then(cfg => {
        if (cancelled) return;
        // Apply DB-backed permission overrides before the routed UI gates on
        // them. A failure leaves the static defaults in place (non-breaking).
        setPermissionOverrides(cfg.rolePermissionOverrides);
        setAppVersion(cfg.appVersion ?? '');
        if (cfg.socialLinks) setSocialLinks({ ...DEFAULT_SOCIAL_LINKS, ...cfg.socialLinks });
      })
      .catch(() => {
        // Network/parse failure — keep static permission defaults, an empty
        // version, and the default social links. The app stays fully usable.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <ConfigContext.Provider value={{ appVersion, socialLinks, loaded }}>
      {children}
    </ConfigContext.Provider>
  );
}
