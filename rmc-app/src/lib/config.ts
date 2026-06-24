import { createContext, useContext } from 'react';

export interface AppConfig {
  appVersion: string;
  rolePermissionOverrides: Partial<Record<string, string[]>>;
}

export interface ConfigCtx {
  appVersion: string;
  loaded: boolean;
}

export const ConfigContext = createContext<ConfigCtx>({
  appVersion: '',
  loaded: false,
});

export function useConfig() {
  return useContext(ConfigContext);
}
