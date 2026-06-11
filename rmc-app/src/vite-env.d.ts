/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Clerk publishable key. When absent, all Clerk UI is hidden and the app
  // runs on the legacy email/password flow only.
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
}
