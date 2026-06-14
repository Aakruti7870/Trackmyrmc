# SEO Strategy

## In scope
- Public marketing homepage (`/`)
- Public brand/discovery messaging visible on the landing page
- Crawl/discovery assets that affect public visibility (`robots.txt`, `sitemap.xml`, `llms.txt`, metadata in `index.html`)

## Out of scope
- Authenticated dashboard and operational routes behind login
- Admin/staff workflows
- Utility auth pages (`/login`, `/register`, `/set-password`) except where they inherit shared SPA shell metadata

## Target audience
- Ready-mix concrete buyers, contractors, and plant operators evaluating or using CONCRETE KING

## Primary keywords
- ready-mix concrete
- RMC plants near me
- concrete dispatch tracking
- concrete delivery tracking
- RMC marketplace

## Dismissed categories
- (None yet)

## Implementation notes
- Public homepage (`/`) is a Vite SPA route with a static prerendered marketing shell embedded directly in `rmc-app/index.html`, so core homepage copy and metadata are visible before JavaScript runs.
- Utility auth routes (`/login`, `/register`, `/set-password`) have dedicated HTML entry points with `noindex,follow` and are intentionally not treated as marketing pages.
