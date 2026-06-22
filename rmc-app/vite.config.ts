import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'

const STATIC_FILES_WITH_SITE_URL = ['robots.txt', 'sitemap.xml', 'llms.txt']
const PLACEHOLDER = '__SITE_URL__'

function staticSiteUrlPlugin(siteUrl: string): Plugin {
  return {
    name: 'static-site-url',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const filePath = req.url?.split('?')[0] ?? ''
        const fileName = filePath.replace(/^\//, '')
        if (!STATIC_FILES_WITH_SITE_URL.includes(fileName)) return next()
        const srcPath = path.resolve(__dirname, 'public', fileName)
        if (!fs.existsSync(srcPath)) return next()
        const raw = fs.readFileSync(srcPath, 'utf-8')
        const content = raw.replaceAll(PLACEHOLDER, siteUrl)
        const contentType =
          fileName.endsWith('.xml') ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8'
        res.setHeader('Content-Type', contentType)
        res.end(content)
      })
    },
    transformIndexHtml(html) {
      return html.replaceAll(PLACEHOLDER, siteUrl)
    },
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist')
      for (const fileName of STATIC_FILES_WITH_SITE_URL) {
        const filePath = path.join(distDir, fileName)
        if (!fs.existsSync(filePath)) continue
        const raw = fs.readFileSync(filePath, 'utf-8')
        fs.writeFileSync(filePath, raw.replaceAll(PLACEHOLDER, siteUrl))
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = (env.VITE_PUBLIC_SITE_URL || 'https://www.goldetech.com').replace(/\/$/, '')
  // The native (Capacitor) build disables the PWA service worker entirely: the
  // wrapped app must always load fresh bundled assets and reach the live API,
  // and the web-push SW (VAPID) doesn't work inside a native WebView anyway.
  const disablePWA = env.VITE_DISABLE_PWA === '1' || env.VITE_DISABLE_PWA === 'true'

  return {
  plugins: [
    staticSiteUrlPlugin(siteUrl),
    react(),
    tailwindcss(),
    VitePWA({
      disable: disablePWA,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'CONCRETE KING RMC — Plant & Driver',
        short_name: 'CONCRETE KING',
        description: 'Ready-mix concrete plant operations, dispatch and live driver delivery tracking.',
        lang: 'en',
        dir: 'ltr',
        theme_color: '#08111f',
        background_color: '#08111f',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
        ],
        screenshots: [
          {
            src: '/social-preview.png',
            sizes: '1200x630',
            type: 'image/png',
            form_factor: 'wide',
            label: 'CONCRETE KING — RMC plant operations & live delivery tracking',
          },
        ],
        shortcuts: [
          {
            name: 'My Orders',
            short_name: 'Orders',
            description: 'View and track your concrete orders',
            url: '/my-orders',
            icons: [{ src: '/pwa-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Nearby Plants',
            short_name: 'Plants',
            description: 'Discover approved RMC plants near you',
            url: '/nearby-plants',
            icons: [{ src: '/pwa-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Pull in our custom Web Push / notification-click handlers. Kept as a
        // plain script in public/ so it survives precache revisioning.
        importScripts: ['/push-sw.js'],
        navigateFallback: '/index.html',
        // The app is auth'd + realtime: never let the service worker serve
        // cached HTML for API calls or intercept/cache the SSE stream.
        // Auth routes have their own HTML entry points (MPA); exclude them so
        // the SW does not override them with the homepage index.html.
        navigateFallbackDenylist: [/^\/api/, /^\/(login|register|set-password)(\/|$)/],
        // Workbox matches RegExp urlPatterns against the full href, so an
        // ^-anchored pathname regex never fires. Use a callback that tests the
        // pathname to actually force NetworkOnly for every API call.
        runtimeCaching: [
          { urlPattern: ({ url }) => url.pathname.startsWith('/api'), handler: 'NetworkOnly' },
        ],
      },
      // SW only matters in the production static build; keep dev untouched.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        login: 'login/index.html',
        register: 'register/index.html',
        'set-password': 'set-password/index.html',
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    proxy: {
      '/api/events': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        selfHandleResponse: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (_proxyReq, _req, res) => {
            res.setHeader('X-Accel-Buffering', 'no');
          });
        },
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  }
})
