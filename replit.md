# CONCRETE KING — RMC Marketplace & Plant Management

A full-stack RMC (Ready-Mix Concrete) marketplace and plant management web application (CONCRETE KING). Customers can discover nearby approved RMC plants and place orders; staff manage plant operations, dispatch, and onboarding.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Routing**: Wouter
- **Styling**: Tailwind CSS v4 + inline styles (teal-green corporate theme, Day/Night modes)
- **Data**: localStorage (no backend required)
- **Icons**: lucide-react
- **Maps**: Google Maps (via `rmc-app/src/components/map` compat layer) with automatic fallback to Leaflet/OpenStreetMap when no key is configured or Google auth fails. Key comes from `GOOGLE_MAPS_BROWSER_KEY` (preferred, domain-restricted) or `GOOGLE_MAPS_API_KEY` / `GOOGLE_PLACES_API_KEY`; the key must have **Maps JavaScript API** enabled (and ideally **Geocoding API** for address search). Optional `GOOGLE_MAPS_MAP_ID` for cloud-styled maps.

## Project Structure

```
rmc-app/
  src/
    lib/
      types.ts       — TypeScript interfaces (Client, Order, Challan, Vehicle, MixDesign, BatchRecord)
      store.ts       — localStorage CRUD stores + seed data
    components/
      Layout.tsx     — Sidebar + responsive layout
    pages/
      Dashboard.tsx  — Metrics, 3D plant, recent dispatch, active orders
      Orders.tsx     — Order management (CRUD)
      Dispatch.tsx   — Challan generation from orders
      Clients.tsx    — Client management (CRUD)
      Vehicles.tsx   — Fleet management (CRUD)
      BatchReport.tsx — Production batch records
      MixDesign.tsx  — Concrete mix proportions by grade
      Reports.tsx    — Analytics, daily trend, grade/client breakdown
```

## Running the App

```bash
cd rmc-app && pnpm run dev
```

Runs on port 5000.

## Modules

1. **Dashboard** — KPI metrics, 3D CSS plant illustration, recent challans & orders
2. **Orders** — Create/edit/delete orders, track dispatch progress per order
3. **Dispatch** — Generate challans from active orders, mark as delivered
4. **Clients** — Manage client companies with contact & GST details
5. **Vehicles** — Transit mixer fleet with driver info and status
6. **Batch Report** — Log each concrete batch with grade, qty, operator
7. **Mix Design** — Concrete proportions (cement/water/sand/aggregate) per grade with visual bars and W/C ratio
8. **Reports** — Time-range analytics with daily bar chart, grade breakdown, client volume

## Design System

One universal teal + mint-white corporate theme with two modes (Day / Night) and an **Auto** mode (default) that follows sunrise/sunset by the clock. Selectable from the user menu and Account Settings. Defined in `rmc-app/src/lib/theme.tsx` as CSS variables; the whole app re-themes via these tokens.

- **Day**: white cards on cool mint page `#f4f7f5`, ink text `#12211d`, muted `#6b7c76`, teal accent ramp (`--gold` = `#178a6e`, dark `#0f766e`)
- **Night**: deep green-ink surfaces (`--bg` `#0c1713`, panel `#12211d`), light text `#eaf4f0`, brighter teal accent (`--gold` = `#27b58c`)
- **Auto** (default): computes sunrise/sunset locally (NOAA approximation) from the remembered Nearby location in localStorage (fallback 06:15/18:30); re-checks every minute — no geolocation prompt, nothing leaves the device
- Accent tokens are still named `--gold*` (legacy key names) but hold the teal ramp
- Green: `#22c55e` (dispatch/positive), Blue: `#38bdf8` (info), Red: `#ef4444` (danger) — stable across modes
- Flat cards via `--glass-1/2/-border` (no blur/glows); surfaces flip per mode (DAY_SURFACES / NIGHT_SURFACES)

## User Preferences

(none set yet)
