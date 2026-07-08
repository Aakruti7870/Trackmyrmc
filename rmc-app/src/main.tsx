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
        colorPrimary: '#178a6e',
        colorBackground: '#ffffff',
        colorText: '#12211d',
        colorTextSecondary: '#6b7c76',
        colorInputBackground: '#f7faf8',
        colorInputText: '#12211d',
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
