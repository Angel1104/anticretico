# Anticretico

Fractional Bolivian *anticrético* real estate investment on Stellar testnet. From 1,000 USDC. Yield is variable and legally backed by the inscription in Derechos Reales.

**Live demo:** https://anticretico.vercel.app
**Pitch script:** [`../anticretico-docs/PITCH.md`](https://github.com/Angel1104/anticretico-docs/blob/main/PITCH.md)
**Process + canon:** https://github.com/Angel1104/anticretico-docs

## Demo

![Anticretico demo](https://raw.githubusercontent.com/Angel1104/anticretico-docs/main/demo.gif)

End-to-end walkthrough: landing → catalog (6 properties with live state) → property detail → admin panel (3 tabs: validations, distributions, rollover) → investor dashboard → owner panel (slider for Retirar/DeFi) → locale switch ES→EN.

## Stack

- Next.js 16 App Router, TypeScript, Tailwind v4 (`@theme` in tokens.css)
- Supabase (Postgres + Auth + Realtime), RLS enabled
- Stellar testnet via `@stellar/stellar-sdk` + `@stellar/freighter-api`
- i18n via `next-intl` (es-BO default, en)
- Vercel (preview per branch, prod on main)

## MVP scope (shipped, verified on-chain)

| Feature | What it does | Verified tx |
|---|---|---|
| Invest | Freighter wallet connect + USDC payment to Trustless Work escrow stub | `17c35e…9b4` |
| Release | Admin validates Derechos Reales + sends escrow to owner wallet | `7f0912…730f` |
| Distribute | Admin batch payment of monthly rent to all token holders | `88c877…ffc6` |
| Rollover | Migrate holders from Finalizado property to En fondeo property | `efda0a…731f` |
| Owner | Retirar / DeFi slider, composite Stellar tx | `3b6c18…e207` |

All txs viewable on https://stellar.expert/explorer/testnet.

## Deliberate pilot shortcuts (real paths are post-pilot epics)

- Escrow is a controlled SRL account (real = Trustless Work Soroban contract)
- Asset is testnet XLM labelled USDC (real = USDC on Stellar mainnet)
- DeFi destination is a labelled testnet account (real = Blend SDK)
- Rollover combines Supabase bookkeeping + on-chain anchor (real = Soroban rollover contract)
- KYC is manual admin (real = third-party KYC provider)

## Local dev

```bash
npm install
vercel env pull .env.local --environment=development
npm run dev
```

See `REPO.md` for commands and conventions.

## Repos

- Code: https://github.com/Angel1104/anticretico
- Docs + process: https://github.com/Angel1104/anticretico-docs
- Project board: https://github.com/users/Angel1104/projects/3
