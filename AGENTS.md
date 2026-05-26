# ZIXI CASINO — Agent Guide

## Repo structure

```
apps/
  api/     — Fastify backend (port auto, Render/Vercel)
  web/     — React SPA (Vite, deployed on Vercel)
  worker/  — Background chain sync scripts
packages/
  shared/    — Types, constants, chest/item definitions, version
  domain/    — Game logic, VIP/mission/XP/market/company engines
  on-chain/  — Settlement, transaction queries, DashboardService
  infrastructure/ — DB (Drizzle ORM + Postgres), KV (Upstash Redis), repos
```

## Workspace

- **pnpm workspace monorepo** (`pnpm@10.33.0`)
- `pnpm-lock.yaml` is the lockfile
- TypeScript 5.4+, `"type": "module"` (ESM)

## Key commands

```bash
pnpm install                  # install all packages
pnpm --filter web dev         # frontend dev server (Vite, http://localhost:5173)
pnpm build:web                # build frontend only
pnpm build                    # build API + frontend

# Type-checking (run from any package dir)
cd packages/shared && npx tsc
cd packages/domain && npx tsc
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit

# Build & type-check in order (required after shared/domain changes):
cd packages/shared && npx tsc
cd packages/domain && npx tsc
cd apps/api && npx tsc --noEmit
```

## Build order dependency

`shared → domain → api` must be built in order. `web` depends on `shared` (`build:web`).

## Version

- Source of truth: `packages/shared/src/constants/version.ts` — `APP_VERSION`
- Tags: `v1.0.5` (master), `v1.0.6`+ on `dev` branch
- Frontend footer/settings read `APP_VERSION` from `@repo/shared`

## Branches

- `master` — stable, production (Vercel + Render API)
- `dev` — feature development, preview on beta Render
- Dev branch API URL: `https://zixi-casino-beta.onrender.com` (set via Vercel env `VITE_API_URL`)

## Key packages

| Package | Import path | Role |
|---------|------------|------|
| `@repo/shared` | Types, `CHEST_CONFIGS`, `APP_VERSION`, `formatNumber` |
| `@repo/domain` | GameManager (12 games), VIP, XP, missions, market, company |
| `@repo/infrastructure` | DB repos (Drizzle), KV (Upstash Redis), ChainClient |
| `@repo/on-chain` | Settlement, TransactionQueryService, DashboardService |

## Important patterns

- **API routes** in `apps/api/src/routes/v1/` — each game/feature has its own file
- **Game resolution**: `packages/domain/src/games/game-manager.ts` — FNV-1a 32bit deterministic hashing
- **Settlement**: async by default (`GAME_SETTLEMENT_ASYNC=true`). Balance credited immediately via DB, chain tx queued to background
- **KV cache**: `apps/api/src/plugins/cache.ts` — per-route TTL caching via Upstash Redis. `invalidateCache()` exists but is not called from routes (cache relies on TTL expiry)
- **Pagination**: `limit`/`page` query params on `GET /api/v1/dashboard/transactions`
- **Locale**: `apps/web/src/locales/zh.json` / `en.json` — used via `useTranslation()` / `t('key')`

## Game routes

Each game has its own route at `apps/api/src/routes/v1/games/<game>.ts`. Some games (coinflip, roulette, horse, shoot-dragon-gate) bypass `GameManager` and implement their own resolution — these are known discrepancies.

## Caching

- Backend API cache: `apps/api/src/plugins/cache.ts` (TTL per route)
- Frontend: most pages use `useEffect` + `api.get()` (no React Query caching). MarketView/CompanyView/LobbyView use `useQuery` with polling
- To reduce server calls, use React Query's `staleTime` for non-critical pages

## DB

- PostgreSQL via Neon (connection URL from `DATABASE_URL` env)
- Drizzle ORM with schema in `packages/infrastructure/src/db/schema.ts`
- KV: Upstash Redis via `@repo/infrastructure` (used for session, cache, mission tracking, check-in streaks)

## Deployment

- **Frontend**: Vercel — auto-deploys from git. Vite build outputs to `apps/web/dist`
- **API**: Render — `render.yaml` config. Starts with `node apps/api/dist/index.js`
- Health check: `GET /health` (Render uses this)
- Env var `VITE_API_URL` controls which API the frontend calls

## Chest/item system

- 6 rarities on master (common→mythic), 8 on dev (+chaos, +abyss, oracle)
- 8 chest types (common→oracle on dev)
- Item definitions: `packages/shared/src/constants/chests.ts`
- Chest opening: `packages/domain/src/rewards/chest-manager.ts`
- Pity system: weighted re-roll among guaranteed rarity and above
- `wallet_ledger_entries` DB table tracks all financial events (game payouts, chest buys, airdrops, transfers)

## Mission system

- API: `GET /api/v1/missions`, `POST /api/v1/missions/claim`
- 4 random daily missions per user (from pool of ~35), determined by FNV hash of date+address
- Progress tracked in KV: `mission:bet:<addr>:<date>`, `mission:win:<addr>:<date>`, `mission:play:<addr>:<date>`
- Some missions require VIP 1+ (checked via `vip_tier` buff type)
- After claiming, missions are hidden (not re-shown)

## Airdrop & check-in

- Airdrop endpoint: `POST /api/v1/wallet/airdrop`
- Midnight reset (date string comparison, not 24h timer)
- Check-in streak tracked in KV: `checkin_streak:<addr>`, `checkin_history:<addr>`
- `last_airdrop:<addr>` stores last claim timestamp

## VIP

- VIP pass item (`vip_pass`) activates a buff with `type: 'vip_tier', value: 1`
- VIP manager checks `b.type === 'vip_tier' && b.value === N` (in addition to legacy `id === 'vip_N_permanent'`)
- VIP 1+ unlocks special missions and game rooms

## Known issues / quirks

- `inferAnnouncementType` in `announcements.ts` guesses type from content keywords — does not read a stored `type` column (column doesn't exist in DB)
- `SERVER_STARTED_AT` in `api/index.ts` may reset on Render cold starts — uptime shows "< 1m"
- `useQuery` with `queryFn` calling state setters is unreliable — use `useEffect` pattern instead for data fetching + component state

## Branch workflow

- Features developed on `dev` branch, tagged per version (`v1.0.6`, `v1.0.7`, ...)
- Master receives merges when stable
- Version tags moved via `git tag -d && git tag && git push --force`
- `git push origin master --force-with-lease` for master updates (shared branch — use with care)

## 🔴 SECURITY: Database credentials — ABSOLUTELY NEVER hardcode

**Database credentials (`DATABASE_URL`, `KV_REST_API_TOKEN`, `ADMIN_PRIVATE_KEY`, etc.) must NEVER be written into any file.**

- ❌ **NEVER create temp/script files with hardcoded `DATABASE_URL` or any credential**
- ❌ **NEVER `console.log()` or `console.error()` database connection strings**
- ❌ **NEVER write credentials to disk for any reason**
- ✅ Use environment variables exclusively: `process.env.DATABASE_URL`
- ✅ One-liner queries via `node -e "..."` with env passed inline
- ✅ Temp files must use `process.env.*` and must be in `.gitignore` before creation
- ✅ If a temp file is needed, CREATE IT IN `C:\Users\CPXru\AppData\Local\Temp\opencode\` (not in the repo)
- ✅ Delete temp files immediately after use

**If this rule is violated, the agent must:**
1. Immediately `git filter-branch --index-filter` to purge the file from ALL history
2. Force push ALL branches
3. Update `.gitignore` to prevent recurrence
4. Report to the user immediately
