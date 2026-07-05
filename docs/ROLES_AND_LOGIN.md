# CONCRETE KING / TrackMyRMC — Roles, Login & Permissions

A complete reference for **how every role logs in, gets online, is recognised by
the system, and what it is allowed to do**.

> **Important naming note**
> In the code there is **no separate `superadmin` role**. The **`authority`**
> role *is* the platform super-admin / owner. What people call the
> "Super Admin login" is simply the **2-step (password + 2FA code)** login that
> the `authority` account uses. So in this document **Authority = Super Admin**.

---

## 1. The roles at a/ glance

| # | Role (code value) | Who they are | Scope |
|---|-------------------|--------------|-------|
| 1 | `authority` | **Super Admin / platform owner** — runs the whole platform, Command Center, global WhatsApp | Cross-tenant (all plants) |
| 2 | `admin` | Plant administrator (or legacy global admin when not tied to a plant) | One plant, or global if `plantId` is empty |
| 3 | `plant_owner` | Owner of a single plant — same powers as `admin`, locked to their plant | One plant |
| 4 | `supervisor` | Oversees plant operations, dispatch & staff attendance | One plant |
| 5 | `dispatcher` | Creates orders, dispatches vehicles | One plant |
| 6 | `plant_operator` | Production — batch reports, mix designs | One plant |
| 7 | `driver` | Field staff, drives a transit mixer, streams live GPS | One plant |
| 8 | `client` | **Customer / User** — places orders, tracks deliveries | External |
| 9 | `accountant` | Finance — read-only reports & challans | One plant |
| 10 | `quality_engineer` | Quality control — mix designs, QC, freshness | One plant |
| 11 | `fleet_manager` | Fleet — vehicles, drivers, fuel logs | One plant |
| 12 | `store_manager` | Inventory / material stock | One plant |

The roles the user asked about map as: **User = `client`**, **Driver = `driver`**,
**Supervisor = `supervisor`**, **Admin = `admin`**, **Authority / Super Admin = `authority`**.

Role list & hierarchy live in `server/src/db/schema.ts` and
`server/src/lib/roleHierarchy.ts`.

---

## 2. How each role logs in

There are **four** distinct login methods. Which one you use depends on your role.

| Role | Primary login | Alternative | Account creation |
|------|---------------|-------------|------------------|
| **User / Customer** (`client`) | Phone OTP (WhatsApp/SMS) | Clerk SSO (phone or Google) | **Self-signup** — auto-created on first verify |
| **Driver** (`driver`) | Phone OTP (WhatsApp/SMS) | Passwordless email OTP | **Provisioned only** (admin creates) |
| **Supervisor / Admin / other staff** | Passwordless **email OTP** | Clerk SSO (email) | **Provisioned only** |
| **Authority (Super Admin)** | **Email + Password**, then **2FA code** | — | **Provisioned only** |

Frontend login screen: `rmc-app/src/pages/Login.tsx`.
Backend routes: `server/src/routes/auth.ts`.

### 2.1 User / Customer — Phone OTP (no password)
1. Enters phone number → `POST /api/auth/otp/send` → a 6-digit code is sent by
   **WhatsApp (Meta)** or **SMS (Twilio)**.
2. Enters the code → `POST /api/auth/otp/verify`.
3. On success `resolveCustomerByPhone` **auto-creates** a `client` + `users`
   record if the phone is new, and returns a long-lived JWT.
4. Optional: **Clerk SSO** (`POST /api/auth/clerk/customer` for verified phone,
   `/api/auth/clerk/customer/google` for verified Google email).

> Phone login **always** resolves to the `client` role only. A non-client phone
> is rejected — staff cannot log in through the customer phone door.

### 2.2 Driver — Phone OTP (provisioned)
- Same phone-OTP endpoints as customers, **but the account must already exist**
  (an admin provisions the driver and links them to a vehicle). A random phone
  that isn't a provisioned driver just becomes a customer, never a driver.
- Can also use passwordless **email OTP** if the driver has an email on file.

### 2.3 Supervisor / Admin / Dispatcher / Operator / Fleet / etc. — Email OTP (passwordless)
1. Enters email → `POST /api/auth/staff/login-method` decides whether this
   account uses `password` (Authority) or `otp` (all other staff).
2. `POST /api/auth/staff/otp/send` → a **10-minute** code is emailed
   (`sendLoginCodeEmail`).
3. `POST /api/auth/staff/otp/verify` → returns a **short-lived (30-min)
   single-session** token.
- There is **no password** for these roles — trying to log in with a password
  returns `403 useOtp`.
- Alternative: **Clerk SSO** with a verified email (`POST /api/auth/clerk`).

### 2.4 Authority (Super Admin) — Password + 2FA
1. `POST /api/auth/login` with `{ email, password }`. Because the role is
   `authority`, the server does **not** return a token yet — it sends a 2FA code
   and responds `{ otpRequired: true }`.
2. `POST /api/auth/superadmin/verify` with `{ email, code }` → issues the
   short-lived single-session token.
- The 2FA step has **no dev shortcut** — a wrong/missing code means no token.
- A canonical demo `admin` can be self-seeded at boot if `REVIEW_DEMO_EMAIL` is
  configured (`server/src/lib/staffAuth.ts`).

### 2.5 Account provisioning summary
- **Customers:** auto-provisioned on first phone/Clerk verify
  (`server/src/lib/customerAccount.ts`).
- **Drivers & staff:** created by an admin via
  `POST /api/user-management/plants/:plantId/users`. Login is limited to
  **active, non-deleted** accounts.
- **Plant owners:** created when a plant is registered or via the owner-invite
  flow (`server/src/routes/plants.ts`).

---

## 3. How the system recognises you (after login)

Once logged in, every request is authenticated by a **JWT token**.

**Token contents:**
| Field | Meaning |
|-------|---------|
| `id` | User's database ID |
| `email` | Real email, or a placeholder `otp_...@otp.local` for phone-only users |
| `role` | One of the role values above |
| `plantId` | Which plant the staff member belongs to (**empty = platform staff**) |
| `linkedClientId` / `linkedDriverId` | Links the login to a `clients` / `drivers` record |
| `sessionVersion` | (staff) bumped on each login so old sessions stop working |

**Session behaviour** (`rmc-app/src/lib/api.ts`, `auth-provider.tsx`):
- Every API call sends `Authorization: Bearer <token>`.
- A `401` (when a token was present) clears the session and redirects to
  `/login`.
- Token + basic user info are stored in `localStorage`.
- **Idle timeout:** 30 minutes of no activity → auto logout.
- **Silent renewal:** activity calls `POST /api/auth/refresh` (throttled to once
  per 5 min) to slide the 30-minute window without forcing re-login.

---

## 4. How a role gets "online" / on-duty

Being logged in is **not** the same as being "online". Online status comes from
the **attendance + live-GPS** system (`server/src/routes/attendance.ts`).

1. **Check in** — staff/driver `POST /api/attendance/check-in` (records time +
   optional GPS). This opens an attendance record (`checkOutAt` is empty).
2. **Stream location** — while checked in, the phone posts GPS fixes to
   `POST /api/attendance/location` roughly every 10 seconds
   (`navigator.geolocation.watchPosition` on the Attendance page; background
   plugin on the native Android build).
3. **Check out** — `POST /api/attendance/check-out` closes the record.

**Status definitions:**
| Status | Meaning |
|--------|---------|
| **On-duty** | Has an open attendance record (checked in, not out) |
| **Online** | On-duty **and** sent a GPS fix within the last ~3 minutes |
| **GPS inactive / dark** | On-duty but GPS has gone silent (app killed, battery dead, permission off) |

- **Driver online** → appears on the dispatch map and **customers can track the
  truck live**.
- **Supervisor / admin** → watch the **Live Duty Map** of everyone on shift. If a
  staffer's GPS goes dark while on-duty, a `duty.stale` alert notifies
  supervisors.

---

## 5. Permission matrix (what each role can do)

Enforced on the backend by `requireRole(...)` middleware; enforced on the
frontend by `ROLE_ALLOWED_PATHS` / `canAccess()` in
`rmc-app/src/lib/permissions.ts`.

| Capability / Area | Roles allowed |
|-------------------|---------------|
| **Platform admin** (`/api/admin`, global `/api/users`) | `authority`, global `admin` (no plant) |
| **User management** (create/edit staff) | `authority`, `admin`, `plant_owner` |
| **Plant management** (`/api/plants`) | `authority`, `admin`, `plant_owner` (platform-scoped) |
| **Command Center** | `authority` only |
| **Global WhatsApp inbox** | `authority`, `admin` (platform) |
| **Orders** (create/dispatch) | `admin`, `dispatcher` |
| **Clients / Vehicles / Drivers** | `authority`, `plant_owner`, `admin`, `supervisor`, `dispatcher` |
| **Batch report / Mix design** | `plant_operator`, `quality_engineer` (+ admins) |
| **Reports & analytics** | `authority`, `admin`, `dispatcher`, `plant_operator`, `accountant` |
| **Attendance check-in/out** | All staff + driver (everyone except `client`) |
| **Live Duty Map** | `authority`, `admin`, `plant_owner`, `supervisor`, `dispatcher`, `plant_operator`, `fleet_manager`, `quality_engineer` |
| **Customer portal** (my orders / challans / tracking) | `client` |
| **Driver portal** (my trips, live location) | `driver` |

### Default landing page after login (`ROLE_DEFAULT_PATH`)
| Role | Lands on |
|------|----------|
| `authority` | `/command` (Command Center) |
| `admin`, `plant_owner`, `supervisor`, `dispatcher` | `/` (Dashboard) |
| `driver` | `/my-trips` |
| `client` | `/nearby-plants` |
| `plant_operator`, `quality_engineer`, `store_manager` | `/batch-report` |
| `accountant` | `/reports` |

---

## 6. Plant-scoping (multi-tenancy)

Every plant's data is isolated. Which data you see depends on your `plantId`
(`server/src/lib/tenancy.ts`, `plantScope`).

- **Platform staff** = `authority`, or `admin` with **no** `plantId`. They see
  **all plants** and global lists. The `isPlatformStaff` check gates every
  cross-tenant route.
- **Plant-scoped staff** = any user with a `plantId`. Every query is
  automatically filtered to `plantId = <their plant>` — they can never see other
  plants' orders, clients, vehicles, or reports.
- `plant_owner` and a plant-bound `admin` have the same powerful surface area but
  are **locked to their single plant**.

---

## 7. Quick answers to the common questions

**"How does a user get online?"**
- *Customer:* just logs in (phone OTP) — "online" isn't relevant to them; they
  place orders and track deliveries.
- *Driver / staff:* logs in **then checks in on Attendance**; their phone streams
  GPS, which makes them "online".

**"How does the system recognise them?"**
- By the **JWT token** issued at login. It carries the role + plant, so every
  request knows exactly who you are, which plant you belong to, and whether
  you're platform staff.

**"What permissions does each role get?"**
- See §5. In short: `authority` = everything platform-wide; `admin` /
  `plant_owner` = everything within a plant; `supervisor` = operations + people;
  `dispatcher` = orders & dispatch; `driver` = own trips + GPS; `client` = own
  orders & live tracking.

---

*Source of truth (if code changes, re-verify here):*
`server/src/routes/auth.ts`, `server/src/lib/staffAuth.ts`,
`server/src/lib/customerAccount.ts`, `server/src/routes/attendance.ts`,
`server/src/routes/positions.ts`, `server/src/lib/tenancy.ts`,
`server/src/lib/roleHierarchy.ts`, `rmc-app/src/lib/permissions.ts`,
`rmc-app/src/pages/Login.tsx`, `rmc-app/src/lib/auth-provider.tsx`.
