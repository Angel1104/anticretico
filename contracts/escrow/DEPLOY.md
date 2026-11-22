# Llavero Escrow — Testnet Deployment Record

First on-chain deployment of the Soroban escrow contract to the Stellar testnet.

## Deployment

| Field | Value |
|---|---|
| Date | 2026-11-22 |
| Network | testnet (`Test SDF Network ; September 2015`) |
| Contract ID | `CBMPEZVUG2ONHR5HSQQQ3E4FMIWIS75FJRHEVYU445TZ6O6HBGVA4XHD` |
| Wasm Hash | `779417c4053b291393efd79fe2656ecc3bb9e21b512e980937aeb215b1bb3ec5` |
| Soroban SDK | `29.0.1` (Protocol v29) |
| Rust target | `wasm32v1-none` |
| Build cmd | `stellar contract build` (stellar-cli 30.0.1) |

## Transactions

| Step | Tx Hash | Explorer |
|---|---|---|
| Wasm upload | `090be2e4463045b351746ec9b22d73678740c2b90985e3d62d9c3e9af9099387` | <https://stellar.expert/explorer/testnet/tx/090be2e4463045b351746ec9b22d73678740c2b90985e3d62d9c3e9af9099387> |
| Contract create | `0a0adc86eef28601755ea97e134005618eaf19a5b7497f8161e4d5e0097068c7` | <https://stellar.expert/explorer/testnet/tx/0a0adc86eef28601755ea97e134005618eaf19a5b7497f8161e4d5e0097068c7> |
| `init(admin, owner, token)` | `279abb70fc01176c5a92c574f037d1df1130feb6c464dcbc609abc19f39d4f4e` | <https://stellar.expert/explorer/testnet/tx/279abb70fc01176c5a92c574f037d1df1130feb6c464dcbc609abc19f39d4f4e> |

Contract page: <https://stellar.expert/explorer/testnet/contract/CBMPEZVUG2ONHR5HSQQQ3E4FMIWIS75FJRHEVYU445TZ6O6HBGVA4XHD>

## Constructor args (stored on-chain)

| Role | Address |
|---|---|
| admin (release authority) | `GARU4SUJVSRNFKFR63QUIIFTHS4PCBALPHCD2AVX5G4RDTYORT2266T2` |
| owner (release destination) | `GCUWAHRVTRCGH7MIMVUIPUO7AOPVAXDKN7ZYEXMNJZRRLVS74X2XAVOD` |
| token (native XLM SAC) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

Admin and owner secrets are stored in the stellar CLI keychain under aliases
`llavero-admin` and `llavero-owner` on the deploying machine. They are not
committed to the repo and are not written into `.env.local`.

## Verification (read-only invokes, right after init)

```
released()         -> false
total_deposited()  -> 0
admin()            -> GARU4SUJVSRNFKFR63QUIIFTHS4PCBALPHCD2AVX5G4RDTYORT2266T2
owner()            -> GCUWAHRVTRCGH7MIMVUIPUO7AOPVAXDKN7ZYEXMNJZRRLVS74X2XAVOD
```

## Reproducing from scratch

```sh
# One-time
stellar keys generate llavero-admin --fund --network testnet
stellar keys generate llavero-owner --fund --network testnet

# Each deploy
export ADMIN_SECRET="$(stellar keys show llavero-admin)"
export OWNER_PUBKEY="$(stellar keys address llavero-owner)"
npx tsx scripts/deploy-escrow-contract.ts
```

The script builds the contract with `stellar contract build`, deploys, and
invokes `init(admin, owner, token)` in one pass.
