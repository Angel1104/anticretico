"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./OwnerPanel.module.css";
import { useTranslations } from "next-intl";
import {
  Button,
  StatePill,
  RiskDisclosure,
  ExplorerLink,
} from "@/components";
import { ownerTx } from "@/lib/stellar/owner";
import { recordOwnerAction } from "@/lib/owner/actions";
import { listOwnerProperties, type OwnerPropertyRow } from "@/lib/owner/queries";

const STORAGE_KEY = "anticretico:wallet";

type Allocation = { withdrawPct: number };

type ActionState =
  | { kind: "idle" }
  | { kind: "signing"; propertyId: string }
  | {
      kind: "done";
      propertyId: string;
      hash: string;
      withdrawUsdc: number;
      defiUsdc: number;
    }
  | { kind: "error"; propertyId: string; message: string };

function formatUsdc(n: number): string {
  return new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 }).format(n);
}

export function OwnerPanel() {
  const t = useTranslations("owner");
  const router = useRouter();
  const [wallet, setWallet] = useState<string | null>(null);
  const [properties, setProperties] = useState<OwnerPropertyRow[] | null>(null);
  const [allocation, setAllocation] = useState<Map<string, Allocation>>(
    new Map(),
  );
  const [state, setState] = useState<ActionState>({ kind: "idle" });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setWallet(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  useEffect(() => {
    if (!wallet) {
      setProperties(null);
      return;
    }
    let active = true;
    listOwnerProperties(wallet).then((rows) => {
      if (!active) return;
      setProperties(rows);
      const init = new Map<string, Allocation>();
      rows.forEach((r) => init.set(r.id, { withdrawPct: 100 }));
      setAllocation(init);
    });
    return () => {
      active = false;
    };
  }, [wallet]);

  if (!wallet) {
    return (
      <div className={styles.notice}>
        <h2>{t("connectRequired")}</h2>
        <p>{t("connectRequiredBody")}</p>
      </div>
    );
  }

  if (properties === null) {
    return <p className={styles.body}>{t("loading")}</p>;
  }

  if (properties.length === 0) {
    return (
      <div className={styles.notice}>
        <h2>{t("noProperties")}</h2>
        <p>{t("noPropertiesBody")}</p>
      </div>
    );
  }

  async function run(property: OwnerPropertyRow) {
    const alloc = allocation.get(property.id) ?? { withdrawPct: 100 };
    const total = property.funded_usdc;
    const withdrawUsdc = Math.floor((total * alloc.withdrawPct) / 100);
    const defiUsdc = total - withdrawUsdc;
    const kind: "withdraw" | "defi_deposit" | "mixed" =
      withdrawUsdc === total
        ? "withdraw"
        : defiUsdc === total
          ? "defi_deposit"
          : "mixed";

    setState({ kind: "signing", propertyId: property.id });
    try {
      const res = await ownerTx({
        ownerPublicKey: wallet!,
        withdrawUsdc,
        defiUsdc,
        propertySlug: property.slug,
      });
      await recordOwnerAction({
        propertyId: property.id,
        ownerWallet: wallet!,
        kind,
        withdrawUsdc,
        defiUsdc,
        stellarTx: res.hash,
      });
      setState({
        kind: "done",
        propertyId: property.id,
        hash: res.hash,
        withdrawUsdc,
        defiUsdc,
      });
      router.refresh();
    } catch (e) {
      setState({
        kind: "error",
        propertyId: property.id,
        message: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  return (
    <div className={styles.wrap}>
      <RiskDisclosure copyKey="investTestnet" />
      {properties.map((p) => {
        const alloc = allocation.get(p.id) ?? { withdrawPct: 100 };
        const total = p.funded_usdc;
        const withdrawUsdc = Math.floor((total * alloc.withdrawPct) / 100);
        const defiUsdc = total - withdrawUsdc;
        const isTarget = state.kind !== "idle" && state.propertyId === p.id;
        return (
          <section key={p.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>
                  {p.barrio}, {p.ciudad}
                </h2>
                <p className={styles.cardAddress}>{p.address}</p>
              </div>
              <StatePill state={p.state} />
            </div>

            <div className={styles.summary}>
              <div>
                <span className={styles.summaryLabel}>
                  {t("receivedTotal")}
                </span>
                <span className={styles.summaryValue}>
                  {formatUsdc(total)} USDC
                </span>
              </div>
            </div>

            <div className={styles.sliderBox}>
              <label className={styles.sliderLabel}>
                {t("allocation")}
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={alloc.withdrawPct}
                  onChange={(e) => {
                    const next = new Map(allocation);
                    next.set(p.id, { withdrawPct: Number(e.target.value) });
                    setAllocation(next);
                  }}
                  className={styles.slider}
                />
              </label>
              <div className={styles.allocationRow}>
                <div className={styles.allocationCell}>
                  <span className={styles.allocationLabel}>
                    {t("withdraw")}
                  </span>
                  <span className={styles.allocationValue}>
                    {formatUsdc(withdrawUsdc)} USDC
                  </span>
                  <span className={styles.allocationPct}>
                    {alloc.withdrawPct}%
                  </span>
                </div>
                <div className={styles.allocationCell}>
                  <span className={styles.allocationLabel}>
                    {t("defi")}
                  </span>
                  <span className={styles.allocationValue}>
                    {formatUsdc(defiUsdc)} USDC
                  </span>
                  <span className={styles.allocationPct}>
                    {100 - alloc.withdrawPct}%
                  </span>
                </div>
              </div>
            </div>

            {alloc.withdrawPct < 100 && (
              <RiskDisclosure copyKey="defiStub" />
            )}

            {isTarget && state.kind === "done" ? (
              <div className={styles.successBox}>
                <p>
                  {t("doneBody", {
                    w: formatUsdc(state.withdrawUsdc),
                    d: formatUsdc(state.defiUsdc),
                  })}
                </p>
                <ExplorerLink kind="tx" value={state.hash} />
              </div>
            ) : isTarget && state.kind === "error" ? (
              <div className={styles.errorBox}>
                <p>{state.message}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setState({ kind: "idle" })}
                >
                  {t("retry")}
                </Button>
              </div>
            ) : isTarget && state.kind === "signing" ? (
              <p className={styles.body}>{t("signing")}</p>
            ) : (
              <Button
                variant="primary"
                size="lg"
                disabled={total <= 0}
                onClick={() => run(p)}
              >
                {t("executeButton")}
              </Button>
            )}
          </section>
        );
      })}
    </div>
  );
}
