---
name: Android AAB build inside the Replit container
description: How to actually build the Capacitor 7 release AAB (bundleRelease) for TrackMyRMC from the Replit workspace, and the non-obvious blockers.
---

# Building the Android release AAB in the Replit container

This repo's Android AABs were historically built in standalone Android Studio (see `exports/*androidstudio*`). It CAN be built in-container, but several things are non-obvious.

## Environment facts (decisive)
- The container is **Ubuntu 24.04 with a standard FHS loader present** (`/lib64/ld-linux-x86-64.so.2`), NOT classic NixOS. So Google's prebuilt SDK binaries (`aapt2`, etc.) run directly — the classic NixOS "cannot execute / missing ELF interpreter" blocker does NOT apply here.
- No `java`, no Android SDK, no `gradle` preinstalled. `/dev/vdd` (the workspace mount) has ~250G free; `df /` shows a misleading 4M overlay — check `/home/runner/workspace`.
- `dl.google.com` is reachable.

## Toolchain setup
- Install JDK via package-management `installSystemDependencies(["jdk21"])` (Nix). **Capacitor 7 REQUIRES JDK 21**, not 17: every `@capacitor/*` android module and the generated `capacitor.build.gradle` hard-set `sourceCompatibility/targetCompatibility = JavaVersion.VERSION_21`; JDK-17 `javac` cannot target 21 and the build fails. (jdk17 was installed first then found insufficient.)
- Android SDK: download Google `commandlinetools-linux` zip into `$HOME/android-sdk/cmdline-tools/latest` (OUTSIDE the repo so it never lands in a checkpoint/ZIP). `yes | sdkmanager --sdk_root=$HOME/android-sdk --licenses`, then install `platform-tools`, `platforms;android-35`, `build-tools;35.0.0` (matches compileSdk/targetSdk 35).
- Web bundle: use the project's native pipeline `pnpm build:native` (vite `--mode capacitor`, keeps `VITE_API_BASE_URL` + PWA off) then `npx cap sync android`. Use **pnpm**, not npm (repo has `pnpm-lock.yaml`). Write `android/local.properties` with `sdk.dir=$HOME/android-sdk`.

## Running the long Gradle build
- **Run `gradlew clean bundleRelease` as a Replit WORKFLOW** (supervisor-managed), not background bash. `nohup`/`setsid &` jobs are torn down mid-run in this environment (confirmed twice: process vanishes, no exit marker). Gradle caches to `~/.gradle` (outside repo) so it is fully resumable if interrupted. Remove the temp workflow afterward so `.replit` stays clean.
- **Why:** a full first build takes ~2.5 min plus a large one-time Gradle-distro + AGP/androidx download; it far exceeds the 120s bash-tool cap and doesn't survive as a detached bash job.

## Output
- `bundleRelease` with no `signingConfig`/keystore produces an **UNSIGNED** `app-release.aab` at `rmc-app/android/app/build/outputs/bundle/release/`. It must be signed with the Play upload key before upload — do not add a signing config unless asked.
- versionCode/versionName live in `rmc-app/android/app/build.gradle`; Play Console can't be queried from here, so flag the "bump if already uploaded" caveat rather than guessing.
