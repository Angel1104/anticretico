/**
 * Build + deploy the Llavero Soroban escrow contract to testnet.
 *
 * Usage:
 *   ADMIN_SECRET=S...  OWNER_PUBKEY=G...  [TOKEN_SAC_ADDRESS=C...]  \
 *     npx tsx scripts/deploy-escrow-contract.ts
 *
 * Requires:
 *   - `stellar` CLI on PATH (>= 30.x)
 *   - rustup with `wasm32v1-none` target installed (or the contract already built)
 *   - env `ADMIN_SECRET` (a funded testnet secret key)
 *   - env `OWNER_PUBKEY` (G-address that will receive funds on release)
 *
 * Defaults TOKEN_SAC_ADDRESS to the native XLM SAC on testnet.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..");
const CONTRACT_DIR = resolve(REPO_ROOT, "contracts/escrow");
const WASM_PATH_V1 = resolve(
  CONTRACT_DIR,
  "target/wasm32v1-none/release/escrow.wasm",
);
const WASM_PATH_UNK = resolve(
  CONTRACT_DIR,
  "target/wasm32-unknown-unknown/release/escrow.wasm",
);

// Native XLM Stellar Asset Contract on testnet.
const DEFAULT_TOKEN_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

function sh(cmd: string, opts: { cwd?: string; silent?: boolean } = {}): string {
  if (!opts.silent) console.log(`$ ${cmd}`);
  try {
    return execSync(cmd, {
      cwd: opts.cwd ?? REPO_ROOT,
      stdio: ["ignore", "pipe", "inherit"],
      encoding: "utf8",
      env: process.env,
    }).trim();
  } catch (e) {
    const err = e as { message?: string; status?: number };
    throw new Error(`Command failed (${err.status ?? "?"}): ${cmd}\n${err.message ?? ""}`);
  }
}

function abort(message: string): never {
  console.error(`\n[deploy-escrow] ${message}`);
  process.exit(1);
}

function main(): void {
  const adminSecret = process.env.ADMIN_SECRET;
  const ownerPublic = process.env.OWNER_PUBKEY;
  const tokenAddress = process.env.TOKEN_SAC_ADDRESS ?? DEFAULT_TOKEN_SAC;

  if (!adminSecret) {
    abort(
      "ADMIN_SECRET env var is required (funded testnet S... secret). " +
        "Generate one with scripts/mint-escrow.ts and fund via friendbot, " +
        "then export ADMIN_SECRET=S... before re-running.",
    );
  }
  if (!ownerPublic) {
    abort("OWNER_PUBKEY env var is required (G-address receiving funds on release).");
  }
  if (!adminSecret.startsWith("S") || !ownerPublic.startsWith("G")) {
    abort("ADMIN_SECRET must start with S and OWNER_PUBKEY with G.");
  }

  // 1. Build
  console.log("[deploy-escrow] Building contract via `stellar contract build`...");
  try {
    sh("stellar contract build", { cwd: CONTRACT_DIR });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    abort(
      `Build failed. On Homebrew-only Rust, wasm32v1-none and wasm32-unknown-unknown ` +
        `targets are not installed. Install rustup + the target OR pre-build the .wasm ` +
        `artifact and place it at:\n  ${WASM_PATH_V1}\nor\n  ${WASM_PATH_UNK}\n\n${msg}`,
    );
  }

  // 2. Locate .wasm
  let wasm: string;
  if (existsSync(WASM_PATH_V1)) wasm = WASM_PATH_V1;
  else if (existsSync(WASM_PATH_UNK)) wasm = WASM_PATH_UNK;
  else abort(`.wasm artifact not found at ${WASM_PATH_V1} or ${WASM_PATH_UNK}`);
  console.log(`[deploy-escrow] Using wasm: ${wasm}`);

  // 3. Configure stellar CLI identity `escrow-admin` from ADMIN_SECRET if missing.
  try {
    sh(`stellar keys address escrow-admin`, { silent: true });
    console.log("[deploy-escrow] Using existing stellar identity `escrow-admin`.");
  } catch {
    console.log("[deploy-escrow] Creating stellar identity `escrow-admin` from ADMIN_SECRET.");
    mkdirSync(resolve(REPO_ROOT, ".tmp"), { recursive: true });
    // `stellar keys add` with --secret-key reads from stdin.
    execSync(`stellar keys add escrow-admin --secret-key`, {
      cwd: REPO_ROOT,
      input: adminSecret,
      stdio: ["pipe", "inherit", "inherit"],
    });
  }

  // 4. Deploy
  console.log("[deploy-escrow] Deploying contract to testnet...");
  const contractId = sh(
    `stellar contract deploy --wasm ${wasm} --source escrow-admin --network testnet`,
  );
  console.log(`[deploy-escrow] Deployed contract ID: ${contractId}`);

  const adminAddress = sh(`stellar keys address escrow-admin`, { silent: true });

  // 5. Initialise
  console.log("[deploy-escrow] Invoking init(admin, owner, token)...");
  sh(
    `stellar contract invoke --id ${contractId} --source escrow-admin --network testnet -- init --admin ${adminAddress} --owner ${ownerPublic} --token ${tokenAddress}`,
  );

  console.log("\n==============================================");
  console.log("Deploy complete.");
  console.log(`  Contract ID : ${contractId}`);
  console.log(`  Admin       : ${adminAddress}`);
  console.log(`  Owner       : ${ownerPublic}`);
  console.log(`  Token (SAC) : ${tokenAddress}`);
  console.log(`  Explorer    : https://stellar.expert/explorer/testnet/contract/${contractId}`);
  console.log("==============================================");
  console.log(
    `\nAdd to .env.local:\n  NEXT_PUBLIC_ESCROW_CONTRACT_ID=${contractId}\n  NEXT_PUBLIC_USE_SOROBAN_ESCROW=true`,
  );
}

main();
