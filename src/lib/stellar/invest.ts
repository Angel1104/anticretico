"use client";

import {
  Asset,
  Horizon,
  Networks,
  Operation,
  TransactionBuilder,
  BASE_FEE,
  Memo,
} from "@stellar/stellar-sdk";
import {
  DEPOSIT_ASSET,
  ESCROW_STUB_PUBLIC,
  STELLAR_HORIZON_URL,
  STELLAR_NETWORK_PASSPHRASE,
} from "./network";
import { signXdr } from "./wallet";

const horizon = new Horizon.Server(STELLAR_HORIZON_URL);

export type InvestResult = {
  hash: string;
  horizonUrl: string;
};

/**
 * Build + sign + submit a payment from the connected wallet to the escrow stub.
 * Amount is in USDC (labelled); on testnet we move native XLM 1:1 as the
 * demonstration asset. See network.ts for the rationale.
 */
export async function investInProperty(params: {
  investorPublicKey: string;
  amountUsdc: number;
  propertySlug: string;
}): Promise<InvestResult> {
  const { investorPublicKey, amountUsdc, propertySlug } = params;

  if (!Number.isInteger(amountUsdc) || amountUsdc < 1000) {
    throw new Error("Monto mínimo: 1000 USDC");
  }

  const account = await horizon.loadAccount(investorPublicKey);

  const asset = DEPOSIT_ASSET === "native" ? Asset.native() : Asset.native();

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: ESCROW_STUB_PUBLIC,
        asset,
        amount: amountUsdc.toFixed(7),
      }),
    )
    .addMemo(Memo.text(`inv:${propertySlug.slice(0, 20)}`))
    .setTimeout(180)
    .build();

  const signedXdr = await signXdr(tx.toXDR(), investorPublicKey);

  const signedTx = TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE);
  const result = await horizon.submitTransaction(signedTx);
  const hash = result.hash;

  return {
    hash,
    horizonUrl: `${STELLAR_HORIZON_URL}/transactions/${hash}`,
  };
}

/** Re-export Networks for convenience */
export { Networks };
