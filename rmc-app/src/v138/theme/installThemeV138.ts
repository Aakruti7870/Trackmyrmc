export type TrackMyRmcTheme = 'concrete-gold' | 'infra-green';

const LIGHT = {
  '--header-bg':'#0D1421','--header-accent':'#FBBF24','--green':'#16A34A','--blue':'#2563EB','--red':'#DC2626',
  '--font-app':'"Inter", "Roboto", system-ui, -apple-system, sans-serif',
};
const DARK = {
  '--header-bg':'#070B13','--header-accent':'#FCD34D','--green':'#22C55E','--blue':'#38BDF8','--red':'#F87171',
  '--font-app':'"Inter", "Roboto", system-ui, -apple-system, sans-serif',
};

/** Additive guard: preserves current theme IDs while forcing brand/status semantics. */
export function installThemeV138() {
  const root = document.documentElement;
  const apply = () => {
    const theme = (root.dataset.theme || 'concrete-gold') as TrackMyRmcTheme;
    const tokens = theme === 'infra-green' ? DARK : LIGHT;
    Object.entries(tokens).forEach(([k,v]) => root.style.setProperty(k,v));
    root.style.setProperty('--tm-success', theme === 'infra-green' ? '#22C55E' : '#059669');
    root.style.setProperty('--status-success', theme === 'infra-green' ? '#22C55E' : '#16A34A');
  };
  apply();
  const observer = new MutationObserver(apply);
  observer.observe(root,{attributes:true,attributeFilter:['data-theme']});
  return () => observer.disconnect();
}
