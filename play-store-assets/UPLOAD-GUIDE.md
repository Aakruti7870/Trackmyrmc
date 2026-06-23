# CONCRETE KING — Google Play upload pack

Everything you need to publish is in this folder. Work top-to-bottom.

## What's in this folder
| File | Where it goes in Play Console |
|---|---|
| `app-release.aab` *(you build this in Android Studio — see below)* | Production → Create new release → App bundles → Upload |
| `icon-512.png` (512×512) | Main store listing → **App icon** |
| `feature-graphic-1024x500.png` (1024×500) | Main store listing → **Feature graphic** |
| `screenshots/01-login.jpg`, `02-privacy.jpg`, `03-register.jpg` | Main store listing → **Phone screenshots** |
| `store-listing.txt` | App name + short & full description (copy/paste) |
| `privacy-policy.txt` | Backup of the policy (URL below is preferred) |
| `alternative/icon-crown-mixer-512.png` | Optional alternate icon design |

> The `.aab` file itself is built in Android Studio (Build → Generate Signed App
> Bundle / APK). It is **not** in this folder — grab it from
> `…\rmc-app\android\app\release\app-release.aab`.

## Key values (copy these exactly)
- **App name:** `CONCRETE KING`
- **Package name:** `com.trackmyrmc.concreteking` (read automatically from the .aab)
- **Privacy policy URL:** `https://www.goldetech.com/privacy`
- **Support email:** `support@goldetech.com`

---

## Step-by-step

### 1. Create / open the app
Play Console → **Create app** → App name `CONCRETE KING`, App, Free → tick the two
declaration boxes → **Create app**.

### 2. Upload the bundle
Left menu → **Test and release → Production → Create new release** →
**App bundles → Upload** → choose `app-release.aab`. Accept **Play App Signing**
if prompted. Add release notes (e.g. "First release") → **Save**.

### 3. Main store listing
Left menu → **Grow → Store presence → Main store listing**.
- App name / short description / full description → from `store-listing.txt`
- App icon → `icon-512.png`
- Feature graphic → `feature-graphic-1024x500.png`
- Phone screenshots → the 3 files in `screenshots/` (add more from your phone if you like)
- Save.

### 4. App content (the questionnaires) — suggested answers
Left menu → **Policy and programmes → App content**. Fill each section:

**Privacy policy:** `https://www.goldetech.com/privacy`

**App access:**
- Choose **"All or some functionality is restricted"** (the app needs a login).
- Add instructions + a working test account on the LIVE site so Google can sign in,
  e.g. provide a staff email + password (use the "Sign in with email" option), or a
  phone number that can receive the one-time code. *You must supply a real working
  login here or the review will be rejected.*

**Ads:** No, the app does not contain ads. *(Change if you add ads later.)*

**Content rating:** Start questionnaire →
- Category: **Business / Productivity / Utility**
- Violence, sexual content, profanity, drugs, gambling: **No** to all
- Result will be **Everyone / PEGI 3**.

**Target audience:** select **18+** (it's a business app). Not designed for children → **No**.

**Data safety:** Declare that the app collects/shares:
- **Personal info:** Name, Email, Phone number
- **Location:** Approximate and Precise location (for delivery + live vehicle tracking)
- **App activity / Other:** Order & delivery records
- Data is **encrypted in transit:** Yes
- Users can **request deletion:** Yes (via support@goldetech.com)
- (These match the privacy policy in this folder.)

**Government apps / News / Financial features:** No (unless applicable to you).

### 5. Countries & pricing
**Production → Countries / regions** → add the countries you want (e.g. India).
App is **Free**.

### 6. Submit for review
When every checklist item shows a green tick → **Production → Review release →
Start rollout to Production** → confirm. Google reviews it (a few hours to a few
days) and emails you when it's live.

---

## Before you submit — must-do
1. **Deploy/publish the app at goldetech.com** so the privacy URL
   `https://www.goldetech.com/privacy` actually loads (Google checks it).
2. **Provide a real test login** in the "App access" section.
3. **Back up your keystore** (`concreteking-release.jks`) and its passwords — you
   need the same keystore for every future update.
