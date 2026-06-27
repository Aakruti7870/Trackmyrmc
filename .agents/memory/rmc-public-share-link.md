---
name: RMC public no-login share links
description: Security shape any public, no-login share link in this app must follow (built for per-trip live tracking).
---

# Public share-link pattern (per-trip live tracking)

**Rule:** a public, no-login share link MUST do all three: (1) store only a SHA-256 HASH of a high-entropy random token (raw lives only in the URL), (2) carry an expiry — issuance passes a TTL (per-trip share = 24h), and the resolver rejects expired AND revoked tokens so the public route 404s, (3) return a MINIMIZED payload with zero client/driver identity or contact — only trip status, vehicle no, site coords, live lat/lng/heading/speed, eta/freshness, plant name.

**Why:** the link is unauthenticated and forwardable; without a TTL it exposes live logistics indefinitely, and any extra field is a PII leak to anyone with the URL.

**How to apply:** mint via createTrackingToken(challanId, createdBy, ttlMs) — do NOT call with default null ttl for a public link. The public GET /api/track/:token route is registered BEFORE requireAuth (in both index.ts and test/app.ts). Resolve through resolveTrackingToken which enforces revoked/expired.

# Attendance role gate
Attendance check-in/check-out are gated to all staff/driver roles but NEVER `client` (requireRole over the non-client enum subset); GET /me stays open to any authed user (clients just see empty records); the plant-wide report is restricted to admin/plant_owner/supervisor/authority and plant-scoped.
