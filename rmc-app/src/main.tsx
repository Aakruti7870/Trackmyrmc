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
        colorPrimary: '#0f6e57',
        colorBackground: '#ffffff',
        colorText: '#0f172a',
        colorTextSecondary: '#5a6b85',
        colorInputBackground: '#ffffff',
        colorInputText: '#0f172a',
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
