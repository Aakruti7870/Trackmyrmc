import { useState, useEffect, type ReactNode } from 'react';
import { api, type AppConfig } from './api';
import { ConfigContext } from './config';
import { setPermissionOverrides } from './permissions';

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [appVersion, setAppVersion] = useState('');
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
      })
      .catch(() => {
        // Network/parse failure — keep static permission defaults and an empty
        // version. The app stays fully usable.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <ConfigContext.Provider value={{ appVersion, loaded }}>
      {children}
    </ConfigContext.Provider>
  );
}
