"use client";

import {
  Horizon,
  Networks,
  Operation,
  TransactionBuilder,
  BASE_FEE,
  Memo,
} from "@stellar/stellar-sdk";
import {
  ESCROW_STUB_PUBLIC,
  STELLAR_HORIZON_URL,
  STELLAR_NETWORK_PASSPHRASE,
  USDC_ASSET,
} from "./network";
import { assetBalance, ensureTrustlineOp, hasTrustline } from "./trustline";
import { signXdr } from "./wallet";

const horizon = new Horizon.Server(STELLAR_HORIZON_URL);

export const MIN_INVESTMENT_USDC = 100;

export type InvestResult = {
  hash: string;
  horizonUrl: string;
  /** True when the tx included a ChangeTrust op (first-time USDC investor). */
  trustlineAdded: boolean;
};

export class InvestTrustlineRequiredError extends Error {
  constructor() {
    super("invest.error.noTrustline");
    this.name = "InvestTrustlineRequiredError";
  }
}

export class InvestNoUsdcBalanceError extends Error {
  constructor() {
    super("invest.error.noUsdcBalance");
    this.name = "InvestNoUsdcBalanceError";
  }
}

/**
 * Build + sign + submit a USDC payment from the connected wallet to the escrow
 * stub. If the investor's wallet does not yet have a trustline to the testnet
 * USDC asset, we prepend a `ChangeTrust` op in the same transaction so the
 * first-time flow stays single-signature. See `./network.ts` for the asset.
 */
export async function investInProperty(params: {
  investorPublicKey: string;
  amountUsdc: number;
  propertySlug: string;
}): Promise<InvestResult> {
  const { investorPublicKey, amountUsdc, propertySlug } = params;

  if (!Number.isInteger(amountUsdc) || amountUsdc < MIN_INVESTMENT_USDC) {
    throw new Error(`Monto mínimo: ${MIN_INVESTMENT_USDC} USDC`);
  }

  const account = await horizon.loadAccount(investorPublicKey);

  const asset = USDC_ASSET;

  // First-time investors won't have a trustline yet; we add it in the same tx.
  const needsTrustline = !hasTrustline(account, asset);

  // If the investor already trusts USDC but has 0 balance, there's nothing to
  // send. Surface a dedicated i18n key so the UI can tell them to top up.
  if (!needsTrustline && !asset.isNative()) {
    if (assetBalance(account, asset) < amountUsdc) {
      throw new InvestNoUsdcBalanceError();
    }
  }

  const opsCount = (needsTrustline ? 1 : 0) + 1;

  const builder = new TransactionBuilder(account, {
    fee: (Number(BASE_FEE) * opsCount).toString(),
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  });

  const trustlineAdded = ensureTrustlineOp(builder, account, asset);

  builder
    .addOperation(
      Operation.payment({
        destination: ESCROW_STUB_PUBLIC,
        asset,
        amount: amountUsdc.toFixed(7),
      }),
    )
    .addMemo(Memo.text(`inv:${propertySlug.slice(0, 20)}`))
    .setTimeout(180);

  const tx = builder.build();

  const signedXdr = await signXdr(tx.toXDR(), investorPublicKey);

  const signedTx = TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE);
  const result = await horizon.submitTransaction(signedTx);
  const hash = result.hash;

  return {
    hash,
    horizonUrl: `${STELLAR_HORIZON_URL}/transactions/${hash}`,
    trustlineAdded,
  };
}

/** Re-export Networks for convenience */
export { Networks };
