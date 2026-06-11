import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'
import { CLERK_PUBLISHABLE_KEY, clerkEnabled } from './lib/clerk'

// Mount ClerkProvider only when a publishable key is present. Without it the app
// renders normally and only the legacy email/password login is available.
const tree = clerkEnabled ? (
  <ClerkProvider
    publishableKey={CLERK_PUBLISHABLE_KEY!}
    afterSignOutUrl="/login"
    appearance={{
      variables: {
        colorPrimary: '#f7c948',
        colorBackground: '#0d1626',
        colorText: '#e7ecf3',
        colorTextSecondary: '#94a3b8',
        colorInputBackground: '#0b1322',
        colorInputText: '#e7ecf3',
      },
    }}
  >
    <App />
  </ClerkProvider>
) : (
  <App />
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>{tree}</StrictMode>,
)
