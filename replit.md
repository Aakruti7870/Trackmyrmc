# CONCRETE KING — RMC Marketplace & Plant Management

A full-stack RMC (Ready-Mix Concrete) marketplace and plant management web application (CONCRETE KING). Customers can discover nearby approved RMC plants and place orders; staff manage plant operations, dispatch, and onboarding.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Routing**: Wouter
- **Styling**: Tailwind CSS v4 + inline styles (dark navy premium theme)
- **Data**: localStorage (no backend required)
- **Icons**: lucide-react

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

- Background: dark navy `#08111f`
- Gold accent: `#f7c948` (primary actions)
- Green: `#22c55e` (dispatch/positive)
- Blue: `#38bdf8` (info/grade badges)
- Red: `#ef4444` (delete/danger)
- Glass cards: gradient + frosted border + subtle inner glow

## User Preferences

(none set yet)
