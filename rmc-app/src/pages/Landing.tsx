import { Redirect, useLocation } from 'wouter';
import SplashScreen from '@/components/SplashScreen';
import { hasSeenSplash } from '@/lib/onboarding';

/* ══ Root "/" — show splash once per session, then go straight to Login ═══ */
export default function Landing() {
  const [, setLoc] = useLocation();

  // Splash already played in a previous visit → skip straight to Login.
  if (hasSeenSplash()) {
    return <Redirect to="/login" />;
  }

  return <SplashScreen onDone={() => setLoc('/login')} />;
}
