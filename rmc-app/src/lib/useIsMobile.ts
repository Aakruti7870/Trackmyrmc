import { useState, useEffect } from 'react';

// Matches the Layout breakpoint (max-width: 900px) that swaps the desktop
// sidebar for the mobile header + bottom tab bar. Guarded so it is SSR-safe
// and returns `false` (desktop) under jsdom, keeping unit tests on the
// unchanged desktop path.
const QUERY = '(max-width: 900px)';

function getMatch(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(getMatch);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
