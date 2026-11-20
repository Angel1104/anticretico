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
import { STELLAR_HORIZON_URL, STELLAR_NETWORK_PASSPHRASE, ESCROW_STUB_PUBLIC } from "./network";

const horizon = new Horizon.Server(STELLAR_HORIZON_URL);

export type PayoutResult = {
  hash: string;
};

/** Build + sign + submit a native XLM payment from a secret-holding account. */
export async function serverPayment(params: {
  fromSecret: string;
  toPublic: string;
  amountUsdc: number;
  memo?: string;
}): Promise<PayoutResult> {
  const { fromSecret, toPublic, amountUsdc, memo } = params;
  const kp = Keypair.fromSecret(fromSecret);
  const account = await horizon.loadAccount(kp.publicKey());

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: toPublic,
        asset: Asset.native(),
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

/** Build + sign + submit a composite tx with multiple payment ops (batch distribution). */
export async function serverBatchPayment(params: {
  fromSecret: string;
  payments: Array<{ toPublic: string; amountUsdc: number }>;
  memo?: string;
}): Promise<PayoutResult> {
  const { fromSecret, payments, memo } = params;
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
        asset: Asset.native(),
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
