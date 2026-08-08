import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import './automatic-theme.css'
import './layout-fixes.css'
import './v138/theme/trackmyrmc-v138.css'
import { installThemeV138 } from './v138'
import App from './App.tsx'
import { CLERK_PUBLISHABLE_KEY, clerkEnabled } from './lib/clerk'
import { startAutomaticTheme } from './lib/autoTheme'

startAutomaticTheme()
installThemeV138()

const computed = getComputedStyle(document.documentElement)
const clerkPrimary = computed.getPropertyValue('--gold').trim() || '#d6a52a'
const clerkBackground = computed.getPropertyValue('--surface').trim() || '#ffffff'
const clerkText = computed.getPropertyValue('--text').trim() || '#17202a'
const clerkMuted = computed.getPropertyValue('--muted').trim() || '#5b6573'
const clerkInputBackground = computed.getPropertyValue('--panel2').trim() || '#fbf8f0'

const tree = clerkEnabled ? (
  <ClerkProvider
    publishableKey={CLERK_PUBLISHABLE_KEY!}
    afterSignOutUrl="/login"
    appearance={{
      variables: {
        colorPrimary: clerkPrimary,
        colorBackground: clerkBackground,
        colorText: clerkText,
        colorTextSecondary: clerkMuted,
        colorInputBackground: clerkInputBackground,
        colorInputText: clerkText,
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
