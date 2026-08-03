---
name: AAB build script — API 36 SDK requirement
description: Build script must install platforms;android-36 (not 35) every run for compileSdk/targetSdk 36 to work.
---

## Rule
When `variables.gradle` sets `compileSdkVersion = 36` / `targetSdkVersion = 36`, the build script **must** install `platforms;android-36`. Using `platforms;android-35` causes a silent Gradle failure because the platform jar is missing.

**Why:** The Android SDK platform packages do not survive container reboots. The build script's SDK install block must always run (not just when `sdkmanager` is missing), and must match the `compileSdkVersion` in `variables.gradle`.

**How to apply:** In `scripts/build-aab.sh`:
- Move `sdkmanager … licenses` and the platform install **outside** the `if [ ! -f … sdkmanager ]` conditional so they always execute.
- Use `platforms;android-36` + `build-tools;35.0.0` (AGP picks latest compatible build-tools automatically).

## Account deletion page
`/account-deletion` is served as a **standalone server-rendered HTML page** (via `accountDeletionPage()` in `server/src/lib/accountDeletionPage.ts`), NOT through the SPA. The server mounts it at line 80 of `index.ts` before the SPA catch-all. This means:
- It works without a login, as required by Play Console.
- It does NOT need to be in `SPA_ROUTES`.
- The admin page `/admin/account-deletion-requests` IS in the SPA and MUST be in `SPA_ROUTES`.

## DB migration for account_deletion_requests
`server/src/db/migrate-account-deletion.ts` is a **standalone script** (calls `pool.end()`). It is NOT auto-run on boot. Must be run manually against production before the deletion form works in the deployed app. Use the `database` skill with `environment: "production"` to apply it, or run `tsx server/src/db/migrate-account-deletion.ts` with the prod DATABASE_URL.
