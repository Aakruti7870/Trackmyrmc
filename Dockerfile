# syntax=docker/dockerfile:1
#
# CONCRETE KING / TrackMyRMC — container image for Google Cloud Run (or any
# container host). Builds the Express backend + the React (Vite) frontend and
# runs them as ONE service: the backend serves the built frontend from
# ../../rmc-app/dist and exposes the API under /api.
#
# IMPORTANT: no application source is modified. The image only packages the
# existing code. The server already reads process.env.PORT first, so Cloud Run's
# injected $PORT (8080) is used automatically.
#
# This is a pnpm monorepo WITHOUT a workspace file: the root, server/ and
# rmc-app/ each have their own lockfile. The server resolves a few integration
# packages (@google-cloud/storage, @google/genai, google-auth-library) from the
# ROOT node_modules via Node's parent lookup, so the root install must be present
# at runtime and the server/ + rmc-app/ sibling layout must be preserved.

########################  Stage 1 — build  ########################
FROM node:20-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# --- Install dependencies first (layer-cached until a manifest changes) ---
# Root deps: integration packages the server resolves from the parent node_modules.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Backend deps.
COPY server/package.json server/pnpm-lock.yaml ./server/
RUN cd server && pnpm install --frozen-lockfile

# Frontend deps.
COPY rmc-app/package.json rmc-app/pnpm-lock.yaml ./rmc-app/
RUN cd rmc-app && pnpm install --frozen-lockfile

# --- Copy the rest of the source and build both apps ---
COPY . .

# Backend: tsc -> server/dist
RUN cd server && pnpm build
# Frontend: tsc -b && vite build -> rmc-app/dist (default web build; served
# same-origin by the backend, so it uses relative /api — no VITE_API_BASE_URL).
RUN cd rmc-app && pnpm build

########################  Stage 2 — runtime  ########################
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# corepack/pnpm kept so `pnpm db:push` / `db:seed` can be run for one-off migrations.
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# Root install (runtime integration deps) + manifest.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Backend runtime: deps, compiled output, plus src + drizzle config so schema
# migrations (drizzle-kit / tsx) can be executed against Cloud SQL when needed.
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/src ./server/src
COPY --from=build /app/server/drizzle.config.ts ./server/drizzle.config.ts

# Built frontend the backend serves (path.resolve(__dirname,'../../rmc-app/dist')).
COPY --from=build /app/rmc-app/dist ./rmc-app/dist

# Cloud Run sets $PORT=8080 and the server honors it. Exposed for local runs.
EXPOSE 8080

WORKDIR /app/server
CMD ["node", "dist/index.js"]
