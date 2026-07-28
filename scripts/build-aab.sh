#!/usr/bin/env bash
set -e

export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which javac))))
export ANDROID_HOME=/home/runner/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

echo "=== Build environment ==="
echo "JAVA_HOME: $JAVA_HOME"
echo "ANDROID_HOME: $ANDROID_HOME"
java -version 2>&1

# Re-install Android SDK if not present (does NOT survive container reboots)
if [ ! -f "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "=== Installing Android SDK ==="
  mkdir -p $ANDROID_HOME/cmdline-tools
  cd /tmp
  curl -sO "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  unzip -q commandlinetools-linux-11076708_latest.zip -d $ANDROID_HOME/cmdline-tools/
  mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest
  yes | sdkmanager --sdk_root=$ANDROID_HOME --licenses >/dev/null 2>&1 || true
  sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" "platforms;android-35" "build-tools;35.0.0" \
    2>&1 | grep -E "^Downloading|^Installing|done" | head -10
  echo "=== SDK installed ==="
fi

# Decode keystore from Replit Secret
echo "=== Decoding keystore ==="
if [ -z "$ANDROID_KEYSTORE_BASE64" ]; then
  echo "ERROR: ANDROID_KEYSTORE_BASE64 secret is not set"; exit 1
fi
KEYSTORE=/tmp/concreteking-release.jks
echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > "$KEYSTORE"
echo "Keystore: $(wc -c < $KEYSTORE) bytes"

# Copy keystore into android/app/ where build.gradle expects it
cp "$KEYSTORE" /home/runner/workspace/rmc-app/android/app/concreteking-release.jks

echo ""
echo "=== Starting Gradle bundleRelease ==="
cd /home/runner/workspace/rmc-app/android
./gradlew clean bundleRelease

echo ""
echo "=== Signing & saving to releases/ ==="
UNSIGNED=app/build/intermediates/intermediary_bundle/release/packageReleaseBundle/intermediary-bundle.aab
mkdir -p /home/runner/workspace/releases

# Extract version from build.gradle
VERSION=$(grep 'versionName' app/build.gradle | head -1 | grep -oP '"\K[^"]+')
VCODE=$(grep 'versionCode' app/build.gradle | head -1 | grep -oP '\d+')
DEST="/home/runner/workspace/releases/app-release-v${VERSION}-vc${VCODE}-signed.aab"

"$JAVA_HOME/bin/jarsigner" \
  -keystore "$KEYSTORE" \
  -storepass "$ANDROID_STORE_PASSWORD" \
  -keypass  "$ANDROID_KEY_PASSWORD" \
  -signedjar "$DEST" \
  "$UNSIGNED" \
  "$ANDROID_KEY_ALIAS"

echo "Signed AAB: $DEST ($(du -h $DEST | cut -f1))"

# Verify
"$JAVA_HOME/bin/jarsigner" -verify -certs "$DEST" 2>&1 | head -3

# Clean up secrets from disk
rm -f "$KEYSTORE" /home/runner/workspace/rmc-app/android/app/concreteking-release.jks
echo "=== Keystore cleared from disk ==="

echo ""
echo "=== BUILD COMPLETE ==="
echo "File ready for Play Console: $DEST"
ls -lh "$DEST"
