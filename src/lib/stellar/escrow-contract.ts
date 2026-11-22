/**
 * Client for the Llavero Soroban escrow contract.
 *
 * Pure functions that build Soroban transactions, hand the XDR to a signer,
 * and submit via the RPC server. All amounts are i128 at the token's native
 * scale (7 decimals for the XLM SAC on testnet).
 *
 * Reads the deployed contract ID from `NEXT_PUBLIC_ESCROW_CONTRACT_ID`.
 * If not set, every write throws early with a clear message.
 */

import {
  Address,
  Contract,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { STELLAR_NETWORK_PASSPHRASE } from "./network";

const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  "https://soroban-testnet.stellar.org";

function contractId(): string {
  const id = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID;
  if (!id) {
    throw new Error(
      "NEXT_PUBLIC_ESCROW_CONTRACT_ID is not set. Deploy first with scripts/deploy-escrow-contract.ts.",
    );
  }
  return id;
}

function server(): rpc.Server {
  return new rpc.Server(SOROBAN_RPC_URL, { allowHttp: SOROBAN_RPC_URL.startsWith("http://") });
}

type SignFn = (xdrString: string) => Promise<string>;

/**
 * Build, simulate, assemble, sign, and submit a Soroban invocation.
 * Returns the hash of the submitted transaction (or the inclusion hash once
 * the RPC confirms it).
 */
async function invokeContract(
  callerAddress: string,
  method: string,
  args: xdr.ScVal[],
  signAndSubmit: SignFn,
): Promise<string> {
  const rpcServer = server();
  const account = await rpcServer.getAccount(callerAddress);

  const contract = new Contract(contractId());
  const operation = contract.call(method, ...args);

  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
  })
    .addOperation(operation)
    .setTimeout(180)
    .build();

  const sim = await rpcServer.simulateTransaction(built);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Soroban simulation failed: ${sim.error}`);
  }
  const prepared = rpc.assembleTransaction(built, sim).build();

  const signedXdr = await signAndSubmit(prepared.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE);
  const submission = await rpcServer.sendTransaction(signedTx);

  if (submission.status === "ERROR") {
    throw new Error(
      `Soroban send failed: ${submission.errorResult?.result.toString() ?? "unknown"}`,
    );
  }
  return submission.hash;
}

/**
 * Investor deposits `amount` (i128, token native scale) into the contract.
 * `walletAddress` must be the current Freighter account.
 */
export async function invokeEscrowDeposit(
  walletAddress: string,
  amountI128String: string,
  signAndSubmit: SignFn,
): Promise<string> {
  const args = [
    nativeToScVal(Address.fromString(walletAddress), { type: "address" }),
    nativeToScVal(BigInt(amountI128String), { type: "i128" }),
  ];
  return invokeContract(walletAddress, "deposit", args, signAndSubmit);
}

/**
 * Admin releases the full contract balance to the owner.
 */
export async function invokeEscrowRelease(
  adminAddress: string,
  signAndSubmit: SignFn,
): Promise<string> {
  return invokeContract(adminAddress, "release", [], signAndSubmit);
}

/**
 * Read-only view: has the escrow already been released?
 *
 * Uses `simulateTransaction` on a synthetic invocation. No signature needed.
 */
export async function getEscrowReleased(deployedContractId?: string): Promise<boolean> {
  const id = deployedContractId ?? contractId();
  const rpcServer = server();

  // simulateTransaction needs a source account that exists on-chain. Any
  // funded testnet account works for a read; we use the contract's own
  // address as the source via `simulateTransaction`'s read-only path.
  // The canonical pattern is to synthesise a dummy sequence.
  const contract = new Contract(id);
  const dummySource = new (await import("@stellar/stellar-sdk")).Account(
    "GAAAAAAAACGC6",
    "0",
  );
  const built = new TransactionBuilder(dummySource, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("released"))
    .setTimeout(60)
    .build();

  const sim = await rpcServer.simulateTransaction(built);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Soroban simulation failed: ${sim.error}`);
  }
  if (!sim.result?.retval) return false;
  const value = scValToNative(sim.result.retval);
  return Boolean(value);
}
