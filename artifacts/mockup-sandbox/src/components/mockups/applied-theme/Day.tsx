import { Showcase } from "./_shared/Showcase";

// Exact token values from rmc-app/src/lib/theme.tsx — THEMES[0] (Day)
const DAY = {
  bg: "#f4f7f5",
  panel: "#ffffff",
  sidebar: "#ffffff",
  line: "rgba(18,33,29,0.10)",
  text: "#12211d",
  muted: "#6b7c76",
  gold: "#178a6e",
  goldDark: "#0f766e",
  goldSoft: "#e6f4ef",
  chipBg: "#f0f9f6",
  promptBg: "#eef8f4",
  promptBorder: "rgba(23,138,110,0.18)",
};

export function Day() {
  return <Showcase t={DAY} modeName="Day" tagline="White cards on cool mint — the approved palette" />;
}
