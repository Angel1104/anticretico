"use client";

import { useState } from "react";
import styles from "./InvestFlow.module.css";
import { useTranslations } from "next-intl";
import { RiskDisclosure, ExplorerLink, Button } from "@/components";
import { connectWallet } from "@/lib/stellar/wallet";
import { investInProperty } from "@/lib/stellar/invest";
import { recordPosition } from "@/lib/db/positions";

type Step =
  | { kind: "amount" }
  | { kind: "connecting" }
  | { kind: "confirm"; amount: number; publicKey: string }
  | { kind: "signing"; amount: number; publicKey: string }
  | { kind: "receipt"; amount: number; publicKey: string; hash: string }
  | { kind: "error"; message: string };

export type InvestFlowProps = {
  propertyId: string;
  propertySlug: string;
  canInvest: boolean;
};

export function InvestFlow({ propertyId, propertySlug, canInvest }: InvestFlowProps) {
  const t = useTranslations("invest");
  const [step, setStep] = useState<Step>({ kind: "amount" });
  const [amountInput, setAmountInput] = useState("1000");

  async function handleContinue() {
    const amount = Number.parseInt(amountInput, 10);
    if (!Number.isFinite(amount) || amount < 1000) {
      setStep({ kind: "error", message: t("errorMinAmount") });
      return;
    }
    setStep({ kind: "connecting" });
    const conn = await connectWallet();
    if ("kind" in conn) {
      setStep({ kind: "error", message: t(`error.${conn.kind}`) });
      return;
    }
    setStep({ kind: "confirm", amount, publicKey: conn.publicKey });
  }

  async function handleSign() {
    if (step.kind !== "confirm") return;
    setStep({ kind: "signing", amount: step.amount, publicKey: step.publicKey });
    try {
      const result = await investInProperty({
        investorPublicKey: step.publicKey,
        amountUsdc: step.amount,
        propertySlug,
      });
      await recordPosition({
        propertyId,
        investorWallet: step.publicKey,
        usdcInvested: step.amount,
        tokensHeld: step.amount,
        depositedTx: result.hash,
      });
      setStep({
        kind: "receipt",
        amount: step.amount,
        publicKey: step.publicKey,
        hash: result.hash,
      });
    } catch (e) {
      setStep({
        kind: "error",
        message: e instanceof Error ? e.message : t("error.unknown"),
      });
    }
  }

  function reset() {
    setStep({ kind: "amount" });
  }

  if (!canInvest) {
    return (
      <Button variant="primary" size="lg" disabled>
        {t("invest")}
      </Button>
    );
  }

  if (step.kind === "amount") {
    return (
      <div className={styles.card}>
        <h3 className={styles.title}>{t("invest")}</h3>
        <label className={styles.label}>
          {t("amount")}
          <div className={styles.inputWrap}>
            <input
              type="number"
              min={1000}
              step={100}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className={styles.input}
            />
            <span className={styles.suffix}>USDC</span>
          </div>
          <span className={styles.hint}>{t("minHint")}</span>
        </label>
        <RiskDisclosure copyKey="investVariableYield" />
        <RiskDisclosure copyKey="investTestnet" />
        <Button variant="primary" size="lg" onClick={handleContinue}>
          {t("continue")}
        </Button>
      </div>
    );
  }

  if (step.kind === "connecting") {
    return (
      <div className={styles.card}>
        <h3 className={styles.title}>{t("connecting")}</h3>
        <p className={styles.body}>{t("connectingBody")}</p>
      </div>
    );
  }

  if (step.kind === "confirm") {
    return (
      <div className={styles.card}>
        <h3 className={styles.title}>{t("confirmTitle")}</h3>
        <dl className={styles.summary}>
          <div>
            <dt>{t("summary.amount")}</dt>
            <dd>{step.amount} USDC</dd>
          </div>
          <div>
            <dt>{t("summary.wallet")}</dt>
            <dd className={styles.mono}>
              {step.publicKey.slice(0, 6)}…{step.publicKey.slice(-4)}
            </dd>
          </div>
          <div>
            <dt>{t("summary.network")}</dt>
            <dd>Stellar Testnet</dd>
          </div>
        </dl>
        <RiskDisclosure copyKey="investVariableYield" />
        <div className={styles.actions}>
          <Button variant="secondary" size="md" onClick={reset}>
            {t("cancel")}
          </Button>
          <Button variant="primary" size="md" onClick={handleSign}>
            {t("sign")}
          </Button>
        </div>
      </div>
    );
  }

  if (step.kind === "signing") {
    return (
      <div className={styles.card}>
        <h3 className={styles.title}>{t("signing")}</h3>
        <p className={styles.body}>{t("signingBody")}</p>
      </div>
    );
  }

  if (step.kind === "receipt") {
    return (
      <div className={`${styles.card} ${styles.success}`}>
        <div className={styles.successIcon} aria-hidden="true">
          ✓
        </div>
        <h3 className={styles.title}>{t("receiptTitle")}</h3>
        <p className={styles.body}>
          {t("receiptBody", { amount: step.amount })}
        </p>
        <div className={styles.explorer}>
          <ExplorerLink kind="tx" value={step.hash} />
        </div>
        <Button variant="secondary" size="md" onClick={reset}>
          {t("done")}
        </Button>
      </div>
    );
  }

  return (
    <div className={`${styles.card} ${styles.error}`}>
      <h3 className={styles.title}>{t("errorTitle")}</h3>
      <p className={styles.body}>{step.message}</p>
      <Button variant="secondary" size="md" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
