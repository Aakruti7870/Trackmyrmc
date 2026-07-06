/**
 * App-wide background layer.
 *
 * The app now uses one simple flat theme with NO photographic backgrounds — the
 * page background is the solid theme colour (var(--bg)) set on <body>. This
 * component is intentionally a no-op so the flat look stays consistent across
 * every screen; it is kept mounted so the layout/import surface is unchanged.
 */
export default function AppBackground() {
  return null;
}
