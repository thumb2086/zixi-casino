Hey everyone,

Working on a side project for the past few months — an on-chain casino platform with provably fair game outcomes.

**What it does:**
9 games (baccarat, dragon tiger, sic bo, bluff dice, bingo, slots, duel, poker, blackjack) where every round is determined by FNV-1a hashing. The idea is to make verifiable fairness the default, not something you have to trust.

**Tech stack:**
TypeScript, React/Vite + Fastify backend, Drizzle ORM + Postgres, Upstash Redis, pnpm monorepo. Fully open source.

**The fairness bit:**
All game outcomes go through FNV-1a → `>>> 0` to avoid the negative modulo bug that's common in JS hash implementations. You can trace every result back to its seed.

Would love feedback on the architecture, the UX, or anything else. Still iterating on it.

Code here if you want to poke around: https://github.com/thumb2086/zixi-casino

Cheers
