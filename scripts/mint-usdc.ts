/**
 * Mint the testnet USDC asset for Llavero (idempotent).
 *
 * What it does, step by step:
 *   1. Load (or generate) the USDC issuer keypair.
 *   2. Load (or generate) the USDC treasury keypair.
 *   3. Friendbot-fund either account if it isn't yet funded.
 *   4. Treasury opens a trustline to USDC:issuer.
 *   5. Issuer sends 1,000,000 USDC to treasury.
 *   6. Print the asset code + issuer pubkey + a stellar.expert link.
 *
 * Safe to re-run: every step checks its own idempotency.
 *
 * Secrets:
 *   - Reads USDC_ISSUER_SECRET and USDC_TREASURY_SECRET from `.env.local`.
 *   - If a seed is missing, a fresh keypair is generated and PRINTED to stdout
 *     so Angel can paste it back into `.env.local`. The script will NOT write
 *     to `.env.local` itself.
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
const USDC_CODE = process.env.NEXT_PUBLIC_USDC_CODE ?? "USDC";
const MINT_AMOUNT = "1000000"; // 1,000,000 USDC

/**
 * Minimal .env.local parser. We don't require dotenv as a runtime dep; this
 * script runs on `tsx` and we only need a handful of keys.
 */
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
    // Not fatal — the env may already be set another way.
  }
}

async function friendbotFund(publicKey: string) {
  const res = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
  if (!res.ok) {
    throw new Error(`Friendbot failed for ${publicKey}: ${res.status}`);
  }
}

async function isFunded(
  horizon: Horizon.Server,
  publicKey: string,
): Promise<boolean> {
  try {
    await horizon.loadAccount(publicKey);
    return true;
  } catch (e) {
    const err = e as { response?: { status?: number } };
    if (err.response?.status === 404) return false;
    throw e;
  }
}

async function ensureFunded(horizon: Horizon.Server, publicKey: string, label: string) {
  if (await isFunded(horizon, publicKey)) {
    console.log(`  [skip] ${label} already funded`);
    return;
  }
  console.log(`  [friendbot] funding ${label}…`);
  await friendbotFund(publicKey);
  // Wait briefly for Horizon to index.
  for (let i = 0; i < 10; i += 1) {
    if (await isFunded(horizon, publicKey)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Friendbot funded ${label} but Horizon never indexed it`);
}

async function hasTrustline(
  horizon: Horizon.Server,
  publicKey: string,
  asset: Asset,
): Promise<boolean> {
  const account = await horizon.loadAccount(publicKey);
  return account.balances.some(
    (b) =>
      b.asset_type !== "native" &&
      "asset_code" in b &&
      "asset_issuer" in b &&
      b.asset_code === asset.getCode() &&
      b.asset_issuer === asset.getIssuer(),
  );
}

async function assetBalance(
  horizon: Horizon.Server,
  publicKey: string,
  asset: Asset,
): Promise<number> {
  const account = await horizon.loadAccount(publicKey);
  const line = account.balances.find(
    (b) =>
      b.asset_type !== "native" &&
      "asset_code" in b &&
      "asset_issuer" in b &&
      b.asset_code === asset.getCode() &&
      b.asset_issuer === asset.getIssuer(),
  );
  return line ? Number(line.balance) : 0;
}

async function openTrustline(
  horizon: Horizon.Server,
  treasury: Keypair,
  asset: Asset,
) {
  if (await hasTrustline(horizon, treasury.publicKey(), asset)) {
    console.log("  [skip] treasury already trusts USDC");
    return;
  }
  const account = await horizon.loadAccount(treasury.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(180)
    .build();
  tx.sign(treasury);
  const res = await horizon.submitTransaction(tx);
  console.log(`  [ok] treasury opened trustline · tx ${res.hash}`);
}

async function mint(
  horizon: Horizon.Server,
  issuer: Keypair,
  treasury: Keypair,
  asset: Asset,
) {
  const current = await assetBalance(horizon, treasury.publicKey(), asset);
  if (current >= Number(MINT_AMOUNT)) {
    console.log(
      `  [skip] treasury already holds ${current} ${asset.getCode()} (>= ${MINT_AMOUNT})`,
    );
    return null;
  }
  const toSend = Number(MINT_AMOUNT) - current;
  const account = await horizon.loadAccount(issuer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: treasury.publicKey(),
        asset,
        amount: toSend.toFixed(7),
      }),
    )
    .setTimeout(180)
    .build();
  tx.sign(issuer);
  const res = await horizon.submitTransaction(tx);
  console.log(`  [ok] minted ${toSend} ${asset.getCode()} · tx ${res.hash}`);
  return res.hash;
}

function keypairFromEnv(secretVar: string): Keypair {
  const seed = process.env[secretVar];
  if (seed) {
    return Keypair.fromSecret(seed);
  }
  const kp = Keypair.random();
  console.log(
    `\n[!] ${secretVar} is not in .env.local. Generated a fresh one — PASTE THIS BACK:\n` +
      `  ${secretVar}="${kp.secret()}"\n` +
      `  Public: ${kp.publicKey()}\n`,
  );
  return kp;
}

async function main() {
  loadDotenv();

  const horizon = new Horizon.Server(HORIZON_URL);

  console.log("Llavero USDC mint — testnet\n");

  console.log("1) Resolving issuer keypair");
  const issuer = keypairFromEnv("USDC_ISSUER_SECRET");
  console.log(`   issuer: ${issuer.publicKey()}`);

  console.log("2) Resolving treasury keypair");
  const treasury = keypairFromEnv("USDC_TREASURY_SECRET");
  console.log(`   treasury: ${treasury.publicKey()}`);

  console.log("3) Funding accounts via Friendbot (idempotent)");
  await ensureFunded(horizon, issuer.publicKey(), "issuer");
  await ensureFunded(horizon, treasury.publicKey(), "treasury");

  const usdc = new Asset(USDC_CODE, issuer.publicKey());

  console.log("4) Opening treasury trustline to USDC");
  await openTrustline(horizon, treasury, usdc);

  console.log("5) Minting USDC from issuer to treasury");
  const mintHash = await mint(horizon, issuer, treasury, usdc);

  console.log("\nDone.");
  console.log("\n==============================================");
  console.log(`  NEXT_PUBLIC_USDC_CODE="${USDC_CODE}"`);
  console.log(`  NEXT_PUBLIC_USDC_ISSUER="${issuer.publicKey()}"`);
  console.log("==============================================\n");
  console.log(
    `Explorer (issuer): https://stellar.expert/explorer/testnet/account/${issuer.publicKey()}`,
  );
  console.log(
    `Explorer (treasury): https://stellar.expert/explorer/testnet/account/${treasury.publicKey()}`,
  );
  if (mintHash) {
    console.log(
      `Explorer (mint tx): https://stellar.expert/explorer/testnet/tx/${mintHash}`,
    );
  }
}

main().catch((e) => {
  console.error("\n[!!] mint-usdc failed:", e);
  if (e && typeof e === "object" && "response" in e) {
    const resp = (e as { response?: { data?: unknown } }).response;
    if (resp?.data) console.error(JSON.stringify(resp.data, null, 2));
  }
  process.exit(1);
});
