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

# Decode keystore from Replit Secret on every run
echo "=== Decoding keystore ==="
if [ -z "$ANDROID_KEYSTORE_BASE64" ]; then
  echo "ERROR: ANDROID_KEYSTORE_BASE64 secret is not set"
  exit 1
fi
echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > /home/runner/workspace/rmc-app/android/app/concreteking-release.jks
echo "Keystore: $(wc -c < /home/runner/workspace/rmc-app/android/app/concreteking-release.jks) bytes"

echo ""
echo "=== Starting Gradle bundleRelease ==="
cd /home/runner/workspace/rmc-app/android
./gradlew clean bundleRelease

echo ""
echo "=== BUILD COMPLETE ==="
AAB=app/build/outputs/bundle/release/app-release.aab
if [ -f "$AAB" ]; then
  echo "Output: $AAB"
  echo "Size: $(du -h "$AAB" | cut -f1)"
  "$JAVA_HOME/bin/jarsigner" -verify -verbose -certs "$AAB" 2>&1 | head -6 || true
  # Clean up decoded keystore — it lives safely in ANDROID_KEYSTORE_BASE64 secret
  rm -f /home/runner/workspace/rmc-app/android/app/concreteking-release.jks
  echo "=== Keystore cleared from disk ==="
else
  echo "ERROR: AAB not found at $AAB"
  exit 1
fi
