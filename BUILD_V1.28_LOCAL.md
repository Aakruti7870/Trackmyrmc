# Build v1.28 Signed APK/AAB Locally

This guide explains how to build the v1.28 signed Android App Bundle (AAB) on your local machine.

## Release Information

- **Version Name:** 1.28
- **Version Code:** 29
- **Package ID:** com.trackmyrmc.concreteking
- **Output:** Signed Android App Bundle (AAB)

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** (v22 or higher)
- **pnpm** (v10 or higher)
- **Java Development Kit (JDK)** (21 or higher)
- **Android SDK** with Build Tools 35+
- **Android Studio** (recommended) or CLI tools
- **Release Keystore File** (`concreteking-release.jks`)

### Verify Prerequisites

```bash
# Check Node.js version
node --version

# Check pnpm version
pnpm --version

# Check Java version
java -version

# Check gradle wrapper (after cloning)
./gradlew --version
```

## Step 1: Clone the Repository

```bash
git clone https://github.com/Aakruti7870/Trackmyrmc.git
cd Trackmyrmc
```

## Step 2: Prepare Android Signing Credentials

### Option A: Environment Variables (Recommended for CI/CD)

Set these environment variables in your shell:

```bash
export ANDROID_STORE_PASSWORD="your-keystore-password"
export ANDROID_KEY_ALIAS="your-key-alias"
export ANDROID_KEY_PASSWORD="your-key-password"
```

### Option B: Local Properties File

Create `rmc-app/android/local.properties`:

```properties
android.useAndroidX=true
android.enableJetifier=true
```

And place your keystore file at: `rmc-app/android/app/concreteking-release.jks`

### Note on Keystore

You must have the release keystore file (`concreteking-release.jks`) that was used to sign previous releases. Without it, you cannot create a release build that's compatible with the Play Store.

## Step 3: Install Dependencies

Navigate to the app directory and install Node dependencies:

```bash
cd rmc-app
pnpm install --frozen-lockfile
```

This will install all required packages including:
- React & TypeScript dependencies
- Capacitor framework
- Build tools

**Expected output:** "added X packages in Y seconds"

## Step 4: Validate Release Configuration

Before building, verify the version numbers match:

```bash
# Check package.json version
node -e "const p=require('./package.json'); console.log('package.json version:', p.version)"

# Check gradle versionCode and versionName
grep -E "versionCode|versionName" android/app/build.gradle
```

**Expected output:**
- package.json: `1.28.0`
- build.gradle versionCode: `29`
- build.gradle versionName: `1.28`

## Step 5: Build Web Assets

Generate the optimized web assets for the native app:

```bash
pnpm build:native
```

This command:
- Compiles TypeScript
- Builds and optimizes the web bundle with Vite
- Prepares assets for Capacitor

**Expected output:** "dist built successfully"

## Step 6: Sync with Capacitor

Sync the web assets to the Android project:

```bash
pnpm exec cap sync android
```

This copies the web build to the Android app's `www` directory.

**Expected output:** "Sync successful"

## Step 7: Build Android Release AAB

Navigate to the Android directory and build:

```bash
cd android
chmod +x gradlew
./gradlew bundleRelease --stacktrace
```

### Build Configuration

The build will:
1. Compile Kotlin/Java code
2. Process resources
3. Create the Android App Bundle (AAB)
4. Apply signing configuration if environment variables are set

### Build Troubleshooting

#### Gradle wrapper not found
```bash
chmod +x ./gradlew
```

#### Out of memory error
```bash
export GRADLE_OPTS="-Xmx4096m"
./gradlew bundleRelease --stacktrace
```

#### Clean rebuild
```bash
./gradlew clean bundleRelease --stacktrace
```

## Step 8: Locate the Built AAB

After a successful build, the unsigned AAB is located at:

```
rmc-app/android/app/build/outputs/bundle/release/app-release.aab
```

Verify the file exists:

```bash
ls -lh app/build/outputs/bundle/release/app-release.aab
```

## Step 9: Sign the AAB (if using environment variables)

If the build wasn't automatically signed, sign it manually:

```bash
cd rmc-app/android

jarsigner -verbose \
  -sigalg SHA256withRSA \
  -digestalg SHA256 \
  -keystore app/concreteking-release.jks \
  -storepass "$ANDROID_STORE_PASSWORD" \
  -keypass "$ANDROID_KEY_PASSWORD" \
  app/build/outputs/bundle/release/app-release.aab \
  "$ANDROID_KEY_ALIAS"
```

### Verify Signature

```bash
jarsigner -verify -verbose \
  app/build/outputs/bundle/release/app-release.aab
```

**Expected output:** "jar verified. The signer's certificate is self-signed."

## Step 10: Rename for Release

Rename the AAB with version information:

```bash
cd rmc-app/android
cp app/build/outputs/bundle/release/app-release.aab \
   app/build/outputs/bundle/release/app-release-v1.28-signed.aab
```

Verify:

```bash
ls -lh app/build/outputs/bundle/release/app-release-v1.28-signed.aab
```

## Create GitHub Release

### Using GitHub Web Interface

1. Navigate to: https://github.com/Aakruti7870/Trackmyrmc/releases/new

2. Fill in the release details:
   - **Tag version:** `v1.28-signed-aab`
   - **Release title:** `Concrete King v1.28 — Signed Release AAB (versionCode 29)`
   - **Description:**
     ```
     Signed Android App Bundle built from the v1.28 release.
     
     - versionCode: 29
     - versionName: 1.28
     - App ID: com.trackmyrmc.concreteking
     - Signed with release keystore
     - Built from main branch
     ```

3. **Attach the AAB file:**
   - Click "Attach binaries by dropping them here or selecting them"
   - Select: `app-release-v1.28-signed.aab`

4. **Publish:**
   - Uncheck "This is a pre-release" (unless you want it as pre-release)
   - Click "Publish release"

### Using GitHub CLI

If you have `gh` CLI installed:

```bash
gh release create v1.28-signed-aab \
  rmc-app/android/app/build/outputs/bundle/release/app-release-v1.28-signed.aab \
  --title "Concrete King v1.28 — Signed Release AAB (versionCode 29)" \
  --notes "Signed Android App Bundle built from the v1.28 release.

- versionCode: 29
- versionName: 1.28
- App ID: com.trackmyrmc.concreteking
- Signed with release keystore
- Built from main branch"
```

## Download the Release

After creating the release, download the signed v1.28 AAB from:

**https://github.com/Aakruti7870/Trackmyrmc/releases/tag/v1.28-signed-aab**

The file will be available as: `app-release-v1.28-signed.aab`

## Complete Build Workflow Summary

```bash
# 1. Clone
git clone https://github.com/Aakruti7870/Trackmyrmc.git
cd Trackmyrmc

# 2. Setup credentials
export ANDROID_STORE_PASSWORD="your-password"
export ANDROID_KEY_ALIAS="your-alias"
export ANDROID_KEY_PASSWORD="your-key-password"

# 3. Install and build
cd rmc-app
pnpm install --frozen-lockfile
pnpm build:native
pnpm exec cap sync android

# 4. Build AAB
cd android
chmod +x gradlew
./gradlew bundleRelease --stacktrace

# 5. Sign (if needed)
jarsigner -verbose \
  -sigalg SHA256withRSA \
  -digestalg SHA256 \
  -keystore app/concreteking-release.jks \
  -storepass "$ANDROID_STORE_PASSWORD" \
  -keypass "$ANDROID_KEY_PASSWORD" \
  app/build/outputs/bundle/release/app-release.aab \
  "$ANDROID_KEY_ALIAS"

# 6. Rename
cp app/build/outputs/bundle/release/app-release.aab \
   app/build/outputs/bundle/release/app-release-v1.28-signed.aab

# 7. Create GitHub release with the AAB file
gh release create v1.28-signed-aab \
  app/build/outputs/bundle/release/app-release-v1.28-signed.aab \
  --title "Concrete King v1.28 — Signed Release AAB (versionCode 29)" \
  --notes "Signed release for v1.28"
```

## Troubleshooting

### Issue: "versionCode mismatch" error

**Solution:** Verify `rmc-app/android/app/build.gradle` contains:
```gradle
versionCode 29
versionName "1.28"
```

### Issue: Keystore password incorrect

**Solution:** Ensure environment variables are set correctly:
```bash
echo $ANDROID_STORE_PASSWORD
echo $ANDROID_KEY_ALIAS
echo $ANDROID_KEY_PASSWORD
```

### Issue: Build fails with "task not found"

**Solution:** Make sure you're in the correct directory:
```bash
cd rmc-app/android
./gradlew bundleRelease
```

### Issue: pnpm install fails

**Solution:** Clear the cache and reinstall:
```bash
pnpm store prune
rm -rf node_modules
pnpm install --frozen-lockfile
```

### Issue: "Out of memory" during build

**Solution:** Increase Java heap size:
```bash
export GRADLE_OPTS="-Xmx4096m -Xms1024m"
./gradlew bundleRelease --stacktrace
```

### Issue: TypeScript compilation errors

**Solution:** Rebuild TypeScript:
```bash
cd rmc-app
pnpm build:native
```

## Version History

| Version | Code | Status | Date | Notes |
|---------|------|--------|------|-------|
| 1.28 | 29 | Latest | - | Current build target |
| 1.19 | 20 | Released | 2026-07-28 | Previous stable release |

## Resources

- [Capacitor Documentation](https://capacitorjs.com/)
- [Android App Bundle (AAB)](https://developer.android.com/guide/app-bundle)
- [Gradle Build Tools](https://developer.android.com/build/releases/gradle-plugin)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)

## Support

For build issues or questions:
1. Check the troubleshooting section above
2. Review the project's GitHub Issues: https://github.com/Aakruti7870/Trackmyrmc/issues
3. Consult the Capacitor docs: https://capacitorjs.com/docs

---

**Last Updated:** 2026-08-03  
**Target Version:** v1.28 (versionCode 29)
