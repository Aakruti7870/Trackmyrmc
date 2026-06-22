import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trackmyrmc.concreteking',
  appName: 'CONCRETE KING',
  // The production web build is emitted here and bundled into the native app.
  // Build it with `pnpm build:native` (disables the PWA SW + points the API at
  // the deployed backend) before running `cap sync android`.
  webDir: 'dist',
  android: {
    // Serve the bundled app from https://localhost inside the WebView. This is
    // the origin the backend CORS allowlist permits for the native app.
    backgroundColor: '#08111f',
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1200,
      backgroundColor: '#08111f',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      backgroundColor: '#08111f',
      style: 'DARK',
    },
  },
};

export default config;
