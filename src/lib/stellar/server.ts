import "server-only";
import {
  Asset,
  Horizon,
  Keypair,
  Operation,
  TransactionBuilder,
  BASE_FEE,
  Memo,
} from "@stellar/stellar-sdk";
import {
  STELLAR_HORIZON_URL,
  STELLAR_NETWORK_PASSPHRASE,
  ESCROW_STUB_PUBLIC,
  USDC_ASSET,
} from "./network";
import { hasTrustline, assetBalance } from "./trustline";

const horizon = new Horizon.Server(STELLAR_HORIZON_URL);

export type PayoutResult = {
  hash: string;
};

/**
 * Check whether `publicKey` has a trustline to the given asset on Horizon.
 * Used by admin flows to short-circuit when the owner hasn't opened one yet.
 */
export async function remoteHasTrustline(
  publicKey: string,
  asset: Asset = USDC_ASSET,
): Promise<boolean> {
  if (asset.isNative()) return true;
  const account = await horizon.loadAccount(publicKey);
  return hasTrustline(account as unknown as { balances: [] }, asset);
}

export async function remoteAssetBalance(
  publicKey: string,
  asset: Asset = USDC_ASSET,
): Promise<number> {
  const account = await horizon.loadAccount(publicKey);
  return assetBalance(account as unknown as { balances: [] }, asset);
}

/**
 * Build + sign + submit a payment from a secret-holding account. Defaults to
 * the testnet USDC asset; pass `asset: Asset.native()` to send native XLM.
 */
export async function serverPayment(params: {
  fromSecret: string;
  toPublic: string;
  amountUsdc: number;
  memo?: string;
  asset?: Asset;
}): Promise<PayoutResult> {
  const { fromSecret, toPublic, amountUsdc, memo, asset = USDC_ASSET } = params;
  const kp = Keypair.fromSecret(fromSecret);
  const account = await horizon.loadAccount(kp.publicKey());

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: toPublic,
        asset,
        amount: amountUsdc.toFixed(7),
      }),
    )
    .setTimeout(180);

  if (memo) builder.addMemo(Memo.text(memo.slice(0, 28)));

  const tx = builder.build();
  tx.sign(kp);
  const result = await horizon.submitTransaction(tx);
  return { hash: result.hash };
}

/**
 * Build + sign + submit a composite tx with multiple payment ops (batch
 * distribution). Defaults to USDC.
 */
export async function serverBatchPayment(params: {
  fromSecret: string;
  payments: Array<{ toPublic: string; amountUsdc: number }>;
  memo?: string;
  asset?: Asset;
}): Promise<PayoutResult> {
  const { fromSecret, payments, memo, asset = USDC_ASSET } = params;
  const kp = Keypair.fromSecret(fromSecret);
  const account = await horizon.loadAccount(kp.publicKey());

  const builder = new TransactionBuilder(account, {
    fee: (Number(BASE_FEE) * payments.length).toString(),
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  });

  for (const p of payments) {
    builder.addOperation(
      Operation.payment({
        destination: p.toPublic,
        asset,
        amount: p.amountUsdc.toFixed(7),
      }),
    );
  }

  builder.setTimeout(180);
  if (memo) builder.addMemo(Memo.text(memo.slice(0, 28)));

  const tx = builder.build();
  tx.sign(kp);
  const result = await horizon.submitTransaction(tx);
  return { hash: result.hash };
}

export { ESCROW_STUB_PUBLIC };
