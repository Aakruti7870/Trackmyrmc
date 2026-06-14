/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Clerk publishable key. When absent, all Clerk UI is hidden and the app
  // runs on the legacy email/password flow only.
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  // Canonical public origin for this deployment (no trailing slash).
  // Used in index.html canonical/OG/JSON-LD tags and injected into
  // robots.txt, sitemap.xml, and llms.txt during build.
  readonly VITE_PUBLIC_SITE_URL?: string;
}
