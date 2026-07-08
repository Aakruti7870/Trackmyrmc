import { Showcase } from "./_shared/Showcase";

// Exact token values from rmc-app/src/lib/theme.tsx — THEMES[1] (Night)
const NIGHT = {
  bg: "#0c1713",
  panel: "#12211d",
  sidebar: "#101d18",
  line: "rgba(234,244,240,0.10)",
  text: "#eaf4f0",
  muted: "#9db3ab",
  gold: "#27b58c",
  goldDark: "#1d9573",
  goldSoft: "#14352b",
  chipBg: "#16261f",
  promptBg: "#0f2620",
  promptBorder: "rgba(39,181,140,0.28)",
};

export function Night() {
  return <Showcase t={NIGHT} modeName="Night" tagline="Same design, dark green-ink surfaces after sunset" />;
}
