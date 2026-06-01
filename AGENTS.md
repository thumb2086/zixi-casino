# ZIXI CASINO — Agent Guide

## Repo structure

```
apps/
  api/     — Fastify backend (port auto, Render)
  web/     — React SPA (Vite, deployed on Vercel)
  worker/  — Background chain sync scripts
packages/
  shared/          — Types, constants, chest/item defs, version, formatNumber
  domain/          — Game logic, VIP/XP/missions/market/company engines
  on-chain/        — Settlement, tx queries, DashboardService
  infrastructure/  — DB (Drizzle ORM + Postgres), KV (Upstash Redis), repos
```

## Workspace

- **pnpm workspace monorepo** (`pnpm@10`), `pnpm-lock.yaml`
- TypeScript 5.4+, ESM (`"type": "module"`)
- All packages importable via `@repo/shared`, `@repo/domain`, `@repo/infrastructure`, `@repo/on-chain`

## Key commands

```bash
pnpm install                         # install all
pnpm --filter web dev                # frontend dev (Vite :5173, proxies /api→:3000)
pnpm build:web                       # build frontend only (shared → web)
pnpm build                           # build shared + web (NOT api)

# Type-checking (order matters after shared/domain changes):
cd packages/shared && npx tsc
cd packages/domain && npx tsc
cd apps/api && npx tsc --noEmit      # API needs domain built first
cd apps/web && npx tsc --noEmit
```

`pnpm build:web` runs `shared → tsc` then `web → vite build`.

## Branch workflow

- `master` — stable production (Vercel + Render)
- `dev` — feature branch, preview on beta Render
- Merge dev→master: `git checkout master && git merge --ff-only dev && git push origin master --tags`
- Tag: `git tag v1.0.x dev && git push origin v1.0.x`
- Version: `packages/shared/src/constants/version.ts`

## Key packages

| Package | Role |
|---------|------|
| `@repo/shared` | `APP_VERSION`, `formatNumber()`, `CHEST_CONFIGS`, `RARITY_NAMES` |
| `@repo/domain` | `GameManager` (resolve all games via FNV-1a), VIP/XP/missions/market/company |
| `@repo/infrastructure` | Drizzle schema, `WalletRepository`, `kv` (Upstash Redis), `ChainClient` |
| `@repo/on-chain` | Settlement, `DashboardService`, `TransactionQueryService` |

## FNV-1a hash rule (CRITICAL)

**Every `_fnv1a32()` call that feeds into `%` must use `>>> 0`:**

```typescript
const hash = this._fnv1a32(seed) >>> 0;  // correct
const num = hash % 6;                      // was negative without >>> 0
```

Applies to: Bingo, DragonTiger drawCard, BluffDice, Duel, Crash, Poker drawCard, Blackjack drawCard, Sicbo, and all bias checks. The `_fnv1a32` method itself returns `>>> 0` but subsequent `Math.imul` chaining can produce negatives — re-apply `>>> 0` after each multiplication step.

## Game-specific notes

| Game | Key facts |
|------|-----------|
| **Duel** | Server determines p2 (always opposite of p1). Payout 1.96x. No draw abuse possible. |
| **DragonTiger** | Dynamic payout `max(2, floor(12/range))`. Gate open fee suggested. |
| **Sicbo** | All-triple → big/small auto-lose. Dynamic total payouts (4→60x, 10→6x). |
| **BluffDice** | Player picks predicted total (5-30). Payout: exact=5x, off≤2=1x(push), else=0x. |
| **Bingo** | Draws 20/75. Player picks 5-10 numbers. Dynamic multiplier by pick count. |
| **Slots** | Triple-only wins (no pair payouts). |
| **Shared** | All games use deterministic FNV-1a hashing via `game-manager.ts`. Admin `bias` param wrapped in `>>> 0`. |

## Balance & settlement

- `adjustBalanceAtomic()` (via raw SQL `UPDATE wallet_accounts SET balance = balance ± delta WHERE balance >= delta RETURNING balance`) prevents race conditions on game bets.
- `creditPayout()` also uses atomic adjust.
- `sync-down.ts` skips addresses with pending `admin_credit` TxIntents to prevent overwrite.
- `wallet_ledger_entries` table tracks all financial events.

## Color system (Tailwind custom colors)

Use these classes instead of raw hex:

| Class | Replaces | Purpose |
|-------|----------|---------|
| `bg-surface` | `bg-[#080810]` | Page background |
| `bg-card` | `bg-[#16162a]` | Card background |
| `bg-elevated` | `bg-[#1e1e3a]` | Hover/elevated surface |
| `text-accent` / `bg-accent` / `border-accent` | `#f5a623` | Gold brand accent |
| `text-secondary` | `#8080aa` | Secondary text |
| `text-muted` | `#50507a` | Muted text |
| `text-info` | `#2979ff` | Info blue |
| `text-success` | `#00c853` | Success green |
| `text-danger` | `#ff1744` | Danger red |
| `text-warning` | `#ff9100` | Warning amber |
| `border-border` | `#2a2a48` | Standard border (supports `/20` opacity) |

Card top-border accents: `card-accent`/`card-info`/`card-success`/`card-warning`/`card-danger`
Section titles: `section-title` + `section-title-{accent|info|success|warning|danger}`
VIP text: `text-gradient-diamond` / `text-gradient-gold`
Glow: `text-glow-success` / `text-glow-danger`

## i18n

- Locale files: `apps/web/src/locales/zh.json` / `en.json`
- All user-facing text uses `useTranslation()` + `t('namespace.key')`
- Keys must be in the correct namespace — earlier bug had `game_data`/`chest_data`/`rarity_labels` accidentally nested inside `xpLevel` instead of `info`.
- Key structure: `info.game_data.*`, `info.chest_data.*`, `txType.*`, `txStatus.*`, `company.*`, etc.

## Layout & responsive

- `app-shell` — max-width 1760px wrapper for all pages
- `content-grid` — 1/2/3 column responsive grid for content sections
- `layout-sidebar` — content + 360px sidebar
- All heavy pages are `React.lazy()` loaded; `Layout.tsx` wraps `<Outlet>` in `<Suspense>`.
- Performance monitoring: `GET /api/v1/stats/performance` → `/app/performance` view

## Number formatting

Always use `formatNumber(value, amountDisplay)` from `@repo/shared` instead of `.toLocaleString()`. The user's `amountDisplay` preference is `'short'` (compact: 兆/億/萬) or `'full'` (full number). The `nf` helper pattern in components:
```typescript
const nf = (v: number | string) => formatNumber(v, amountDisplay === 'full' ? 'full' : 'short');
```

Do NOT call `.toLocaleString()` directly for numeric values — it bypasses the short/full preference.

## Leaderboard

- Three tabs: 經驗榜 (xp), 資產榜 (asset)
- Kings (`leaderboard_kings` DB table) displayed as top-3 banner ABOVE both tabs
- All leaderboard types (xp/asset/week/month/season) are prefetched on mount for instant tab switching
- Period types: WEEKLY (ends Sunday 3AM), MONTHLY (end of month), SEASON (end of quarter)

## VIP games (room-manager)

- `MultiplayerGameManager` in `packages/domain/src/games/room-manager.ts`
- `resolvePokerHand` — real 10-hand-rank evaluation with kickers
- `resolveBluffDice` — counts actual dice values, finds bluffer/challenger
- Rooms stored in KV, bots auto-fill to 70% capacity

## API endpoints

| Path | Purpose |
|------|---------|
| `/api/v1/leaderboard?type={xp\|season\|kings\|asset}` | Leaderboard data |
| `/api/v1/stats/performance` | Server uptime, user count, session count, 24h tx count |
| `/api/v1/stats/health` | Old health endpoint (uptime %, failure rate) |
| `/api/v1/stats/recent-txs` | Recent wallet ledger entries |
| `/api/v1/support/chat/stream` | SSE for real-time chat |

## Company system

- `/upgrade-fab` chip-only, deducts `fabLevel × 10,000` from company cash
- `/deposit` wallet ZXC → company cash
- Hire deposit: `salary × 10` deducted from company cash
- Bankruptcy: `cash < -5000` auto-fires all employees, resets level/products

## 🔴 SECURITY: No hardcoded credentials

- NEVER write `DATABASE_URL`, `KV_REST_API_TOKEN`, `ADMIN_PRIVATE_KEY` into any file
- Use `process.env.*` exclusively
- Temp files go to `C:\Users\CPXru\AppData\Local\Temp\opencode\` (gitignored parent)
- Delete temp files immediately after use
- If violated: `git filter-branch` + force push all branches + update `.gitignore`
