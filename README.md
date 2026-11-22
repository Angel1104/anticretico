# Llavero

Llavero permite que varias personas cofinancien un anticrético en Bolivia desde 100 USDC en Stellar, cobren renta mensual mientras el inmueble está alquilado y recuperen su capital al final del plazo.

**Live demo:** https://anticretico.vercel.app
**Pitch script:** [`../anticretico-docs/PITCH.md`](https://github.com/Angel1104/anticretico-docs/blob/main/PITCH.md)
**Process + canon:** https://github.com/Angel1104/anticretico-docs

## Demo

**Video (MP4, desktop + mobile):** https://github.com/Angel1104/anticretico-docs/raw/main/demo.mp4
**GIF (short loop):** ![Llavero demo](https://raw.githubusercontent.com/Angel1104/anticretico-docs/main/demo.gif)

End-to-end walkthrough: landing → catalog (6 properties with live state) → property detail → admin panel (3 tabs: validations, distributions, rollover) → investor dashboard → owner panel (slider for Retirar/DeFi) → locale switch ES→EN. The MP4 shows the same flow first in desktop (1280×720), then in mobile viewport (iPhone 15: 390×844 + touch).

## Stack

- Next.js 16 App Router, TypeScript, Tailwind v4 (`@theme` in tokens.css)
- Supabase (Postgres + Auth + Realtime), RLS enabled
- Stellar testnet via `@stellar/stellar-sdk` + `@stellar/freighter-api`
- i18n via `next-intl` (es-BO default, en)
- Vercel (preview per branch, prod on main)

## MVP scope (shipped, verified on-chain)

| Name | Description | Verified transaction |
|---|---|---|
| Invest | Freighter wallet connect + USDC payment to Trustless Work escrow stub | [`17c35e332ddfb683f5a965b2cd25d9d7d7de8c0f608c431230a984981a625b3d`](https://stellar.expert/explorer/testnet/tx/17c35e332ddfb683f5a965b2cd25d9d7d7de8c0f608c431230a984981a625b3d) |
| Release | Admin validates Derechos Reales + sends escrow to owner wallet | [`7f09124bdf277d10b680ea727827b40a039356be0de3cba59b4b021af469730f`](https://stellar.expert/explorer/testnet/tx/7f09124bdf277d10b680ea727827b40a039356be0de3cba59b4b021af469730f) |
| Distribute | Admin batch payment of monthly rent to all token holders | [`88c8777511ec980371e9e1bc9541845dd09b1d8cfecaaaa9754ceaef98c3ffc6`](https://stellar.expert/explorer/testnet/tx/88c8777511ec980371e9e1bc9541845dd09b1d8cfecaaaa9754ceaef98c3ffc6) |
| Rollover | Migrate holders from Finalizado property to En fondeo property | [`efda0a977f9359fa63a1b95b2d8ccbde7ca433bc4d03dd56f6b98efa39e0731f`](https://stellar.expert/explorer/testnet/tx/efda0a977f9359fa63a1b95b2d8ccbde7ca433bc4d03dd56f6b98efa39e0731f) |
| Owner | Retirar / DeFi slider, composite Stellar tx | [`3b6c18f693129fe5a8818c50296ca02f2b87b19d96c6171529a56abe6ce3e207`](https://stellar.expert/explorer/testnet/tx/3b6c18f693129fe5a8818c50296ca02f2b87b19d96c6171529a56abe6ce3e207) |

## Public Stellar addresses

These are public testnet accounts only; no secret keys are included.

| Role | Public key | Stellar Expert |
|---|---|---|
| Escrow (SRL anticresista — pilot stub) | `GAMZIJKMZMJMGPN5QRQUPGCFG4O3X2A74XSOCYJPV6X4KUZ2JXMMXYUP` | [Inspect account](https://stellar.expert/explorer/testnet/account/GAMZIJKMZMJMGPN5QRQUPGCFG4O3X2A74XSOCYJPV6X4KUZ2JXMMXYUP) |
| Distributor | `GAKVPMBNXANOWIDQF3TKAFNRPH3ANSAYQKXDYVMJHJQDWJKPT6QRUZK3` | [Inspect account](https://stellar.expert/explorer/testnet/account/GAKVPMBNXANOWIDQF3TKAFNRPH3ANSAYQKXDYVMJHJQDWJKPT6QRUZK3) |
| Blend DeFi (pilot stub) | `GDHII67HBWUSO22DUUH5KAKO7AXQDWB4HGWYNOWJG7DXV5IUTQ45YNX4` | [Inspect account](https://stellar.expert/explorer/testnet/account/GDHII67HBWUSO22DUUH5KAKO7AXQDWB4HGWYNOWJG7DXV5IUTQ45YNX4) |

## Deliberate pilot shortcuts (real paths are post-pilot epics)

- Escrow is a controlled SRL account (real = Trustless Work Soroban contract)
- Asset is testnet XLM labelled USDC (real = USDC on Stellar mainnet)
- DeFi destination is a labelled testnet account (real = Blend SDK)
- Rollover combines Supabase bookkeeping + on-chain anchor (real = Soroban rollover contract)
- KYC is manual admin (real = third-party KYC provider)

## Local dev

1. Copy the environment template:

```bash
cp .env.example .env.local
```

Fill in `.env.local` with your own Supabase and Stellar testnet values. For a local Supabase instance, use the API URL, anon key, and service-role key printed by `supabase start`; no access to the team's Vercel project is required.

2. Initialize and seed Supabase locally (the repository already includes `supabase/config.toml`, so `supabase init` can be skipped after cloning):

```bash
supabase init
supabase start
supabase db push
supabase db seed
```

The schema is defined by `supabase/migrations/0001_init.sql` through `supabase/migrations/0004_rollovers.sql`; development seed data lives in `supabase/seed.sql`.

3. Generate any pilot Stellar accounts you need, then fund each public key on testnet with the Friendbot command printed by the script:

```bash
npx tsx scripts/mint-escrow.ts
```

Copy public keys to the matching `NEXT_PUBLIC_*` variables and keep secret keys only in the server-side variables in `.env.local`.

4. Start the app:

```bash
npm install && npm run dev
```

See `REPO.md` for commands and conventions.

## Repos

- Code: https://github.com/Angel1104/anticretico
- Docs + process: https://github.com/Angel1104/anticretico-docs
- Project board: https://github.com/users/Angel1104/projects/3
