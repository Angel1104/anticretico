/**
 * Mint a fresh "escrow + distributor" testnet keypair, fund via Friendbot, and
 * (when the USDC asset is configured) open a trustline to USDC so the account
 * can hold + receive the stablecoin.
 *
 * Usage:
 *   npx tsx scripts/mint-escrow.ts [--role=escrow|distributor]
 *
 * The role flag is cosmetic — it only labels the output — but it reminds the
 * operator what this keypair will be wired into.
 */

import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

function loadDotenv() {
  const path = resolve(process.cwd(), ".env.local");
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      let value = m[2];
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // Not fatal.
  }
}

async function friendbotFund(publicKey: string) {
  const res = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
  if (!res.ok) {
    throw new Error(`Friendbot failed for ${publicKey}: ${res.status}`);
  }
}

async function openTrustline(
  horizon: Horizon.Server,
  kp: Keypair,
  asset: Asset,
) {
  const account = await horizon.loadAccount(kp.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(180)
    .build();
  tx.sign(kp);
  const res = await horizon.submitTransaction(tx);
  return res.hash;
}

async function main() {
  loadDotenv();

  const roleArg = process.argv.find((a) => a.startsWith("--role="));
  const role = roleArg ? roleArg.split("=")[1] : "escrow";

  const kp = Keypair.random();
  console.log(`[${role}] generated keypair`);
  console.log(`  PUBLIC: ${kp.publicKey()}`);
  console.log(`  SECRET: ${kp.secret()}\n`);

  console.log("[friendbot] funding…");
  await friendbotFund(kp.publicKey());

  const horizon = new Horizon.Server(HORIZON_URL);

  const code = process.env.NEXT_PUBLIC_USDC_CODE ?? "USDC";
  const issuer = process.env.NEXT_PUBLIC_USDC_ISSUER;

  if (!issuer) {
    console.log(
      "\n[warn] NEXT_PUBLIC_USDC_ISSUER is not set — skipping USDC trustline.\n" +
        "        Run `npx tsx scripts/mint-usdc.ts` first, add the issuer to .env.local,\n" +
        "        then re-run this script if you want the trustline opened automatically.",
    );
    return;
  }

  const asset = new Asset(code, issuer);

  // Horizon can lag behind Friendbot. Retry a few times.
  for (let i = 0; i < 10; i += 1) {
    try {
      await horizon.loadAccount(kp.publicKey());
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`[trustline] opening ${code}:${issuer.slice(0, 6)}…`);
  const trustHash = await openTrustline(horizon, kp, asset);
  console.log(`  ok · tx ${trustHash}`);
  console.log(
    `  explorer https://stellar.expert/explorer/testnet/tx/${trustHash}`,
  );
}

main().catch((e) => {
  console.error("\n[!!] mint-escrow failed:", e);
  process.exit(1);
});
