# REPO.md

Anticretico — Next.js 16 App Router (TypeScript, Tailwind v4, src-dir, @/* import alias). The docs repo lives at `/Users/angel/Ventures/anticretico-docs`.

| Command | What |
|---|---|
| `npm install` | Install dependencies |
| `npm test` | Vitest unit + integration (added by first epic that writes tests — ANT-CATALOG) |
| `npx tsc --noEmit` | Type check (acts as lint in MVP; ESLint disabled at scaffold) |
| `npx playwright test` | Playwright end-to-end (added by first epic that writes e2e) |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` | Production build |

## Layers
- `src/app/` — App Router routes (`src/app/(public)/*` landing + catalog, `src/app/(investor)/*` dashboard + invest flow, `src/app/(admin)/*` admin, `src/app/(owner)/*` owner + rollover)
- `src/app/api/` — server routes for Stellar, Trustless Work, Pollar, Blend integrations
- `src/lib/stellar/` — Stellar SDK wrappers (connect, sign, fetch tx)
- `src/lib/escrow/` — Trustless Work SDK wrappers
- `src/lib/distribution/` — Pollar SDK wrappers
- `src/lib/defi/` — Blend SDK wrappers
- `src/lib/db/` — Supabase client + typed queries
- `src/components/` — React components that mirror `/Users/angel/Ventures/anticretico-docs/design/system/components/` 1:1
- `src/i18n/` — `next-intl` messages (`es-BO`, `en`)
- `src/styles/tokens.css` — generated from `/Users/angel/Ventures/anticretico-docs/design/system/tokens.json` by `scripts/sync-tokens.ts`

## Local conventions
- **Tokens, not raw values.** No hex, spacing or font-size literals in code. Values come from `src/styles/tokens.css` (CSS variables) or a typed TS re-export.
- **Components, not ad-hoc JSX.** A component not in `src/components/` matching a design-system entry does not exist: stop and report. Propose a new component in the docs repo first.
- **i18n or nothing.** Every user-facing string lives in `src/i18n/{locale}.json`. A string without a key is a defect, including the 9 fixed `RiskDisclosure` copy keys.
- **No mainnet.** The Stellar network passphrase is hard-coded to `TESTNET` in `src/lib/stellar/network.ts`. Any mainnet reference in code is a stop-and-report.
- **No raw tx hash in UI.** Use `<ExplorerLink>` always.
- **Server actions over `/api` when possible.** API routes are only for Stellar tx construction that needs a secret (sponsor fee bumps).

## Env
- `.env.local` — personal dev secrets, git-ignored
- `.env.dev` — shared dev secrets (Supabase dev project, testnet horizon URL, Trustless Work testnet keys, Pollar testnet keys, Blend testnet address)
- `.env.stage` — shared stage secrets (same providers, separate Supabase project)
- Vercel preview = `dev`; Vercel main = `stage`; Vercel production = `prod` (no secrets in prod until mainnet epic post-pilot)
