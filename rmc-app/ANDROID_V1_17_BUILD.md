# TrackMyRMC Android v1.17 (versionCode 18)

## Included

- Native Android home-screen widget.
- Role-aware widget data for Driver, Customer/User, Staff, Admin and Plant Owner.
- Persistent foreground GPS while an attendance shift is checked in.
- GPS continues while the phone is locked and stops after check-out/logout.
- Driver trip, customer order/challan and plant-production data synchronization.
- Android 13+ notification permission and Android background-location declarations.

## Prepare the Android project

From the repository root:

```bash
pnpm install --frozen-lockfile
cd rmc-app
```

Create `.env.capacitor` if it does not already exist:

```env
VITE_API_BASE_URL=https://trackmyrmc.com
```

Then run:

```bash
pnpm build:native
pnpm exec cap sync android
```

Open this folder in Android Studio:

```text
rmc-app/android
```

Wait for Gradle Sync to complete.

## Generate the Play Console AAB

In Android Studio:

1. Select **Build → Generate Signed Bundle / APK**.
2. Select **Android App Bundle**.
3. Choose the existing TrackMyRMC upload keystore.
4. Select the `release` build variant.
5. Generate the bundle.

Expected output:

```text
rmc-app/android/app/build/outputs/bundle/release/app-release.aab
```

Release identity:

```text
applicationId: com.trackmyrmc.concreteking
versionName: 1.17
versionCode: 18
```

## First-device permission test

After installing a test build:

1. Sign in as a driver.
2. Check in from Attendance.
3. Allow precise location, background location and notifications.
4. Add the TrackMyRMC widget from the Android widget picker.
5. Lock the phone for several minutes.
6. Verify the persistent GPS notification remains visible.
7. Unlock and confirm the widget displays the active trip.
8. Check out or log out and verify GPS stops.

## Notes

The unsigned GitHub Actions artifact is only for build validation. A Play Console update must be signed with the same upload key already registered for the application.
