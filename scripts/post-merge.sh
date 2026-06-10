#!/bin/bash
set -e

echo "==> Installing server dependencies"
cd server && pnpm install --frozen-lockfile 2>/dev/null || pnpm install
cd ..

echo "==> Installing rmc-app dependencies"
cd rmc-app && pnpm install --frozen-lockfile 2>/dev/null || pnpm install
cd ..

echo "==> Pushing DB schema (drizzle-kit push)"
cd server && npx drizzle-kit push --config drizzle.config.ts 2>&1 | tail -5 || true
cd ..

echo "==> Post-merge setup complete"
