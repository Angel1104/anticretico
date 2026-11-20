"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./AdminPanel.module.css";
import { useTranslations } from "next-intl";
import { Button, StatePill, RiskDisclosure, ExplorerLink } from "@/components";
import { releaseEscrow } from "@/lib/admin/actions";
import type { AdminPropertyRow } from "@/lib/admin/queries";

const STORAGE_KEY = "anticretico:wallet";

type ReleaseState =
  | { kind: "idle" }
  | { kind: "confirm"; propertyId: string; confirmText: string }
  | { kind: "signing"; propertyId: string }
  | { kind: "done"; propertyId: string; hash: string }
  | { kind: "error"; propertyId: string; message: string };

function formatUsdc(n: number): string {
  return new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 }).format(n);
}

export function AdminPanel({ properties }: { properties: AdminPropertyRow[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [wallet, setWallet] = useState<string | null>(null);
  const [state, setState] = useState<ReleaseState>({ kind: "idle" });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setWallet(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const adminAllowList = (process.env.NEXT_PUBLIC_ADMIN_WALLETS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const isAdmin = !!wallet && adminAllowList.includes(wallet);

  if (!wallet) {
    return (
      <div className={styles.notice}>
        <h2>{t("connectRequired")}</h2>
        <p>{t("connectRequiredBody")}</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.notice}>
        <h2>{t("notAuthorized")}</h2>
        <p>
          {t("notAuthorizedBody")}{" "}
          <span className={styles.mono}>
            {wallet.slice(0, 6)}…{wallet.slice(-4)}
          </span>
        </p>
      </div>
    );
  }

  async function handleRelease(propertyId: string) {
    if (state.kind !== "confirm") return;
    if (state.confirmText !== "LIBERAR") return;
    setState({ kind: "signing", propertyId });
    try {
      const res = await releaseEscrow({ propertyId, adminWallet: wallet! });
      setState({ kind: "done", propertyId, hash: res.hash });
      router.refresh();
    } catch (e) {
      setState({
        kind: "error",
        propertyId,
        message: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  const pending = properties.filter(
    (p) => p.state === "En fondeo" || p.state === "En trámite",
  );
  const done = properties.filter(
    (p) => p.state !== "En fondeo" && p.state !== "En trámite",
  );

  return (
    <div className={styles.wrap}>
      <section>
        <h2 className={styles.sectionTitle}>{t("validations")}</h2>
        {pending.length === 0 && <p className={styles.empty}>{t("noneReady")}</p>}
        {pending.map((p) => {
          const isTarget = state.kind !== "idle" && state.propertyId === p.id;
          return (
            <div key={p.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h3 className={styles.cardTitle}>
                    {p.barrio}, {p.ciudad}
                  </h3>
                  <p className={styles.cardAddress}>{p.address}</p>
                </div>
                <StatePill state={p.state} />
              </div>
              <dl className={styles.summary}>
                <div>
                  <dt>{t("fundedTotal")}</dt>
                  <dd>{formatUsdc(p.funded_usdc)} USDC</dd>
                </div>
                <div>
                  <dt>{t("investors")}</dt>
                  <dd>{p.investors_count}</dd>
                </div>
                <div>
                  <dt>{t("ownerWallet")}</dt>
                  <dd className={styles.mono}>
                    {p.owner_wallet
                      ? `${p.owner_wallet.slice(0, 6)}…${p.owner_wallet.slice(-4)}`
                      : t("missingOwner")}
                  </dd>
                </div>
              </dl>

              {isTarget && state.kind === "done" ? (
                <div className={styles.successBox}>
                  <p>{t("releasedBody")}</p>
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
              ) : isTarget && state.kind === "confirm" ? (
                <div className={styles.confirmBox}>
                  <RiskDisclosure copyKey="investTestnet" />
                  <p className={styles.body}>{t("confirmBody")}</p>
                  <div className={styles.inputWrap}>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="LIBERAR"
                      value={state.confirmText}
                      onChange={(e) =>
                        setState({
                          kind: "confirm",
                          propertyId: p.id,
                          confirmText: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className={styles.actions}>
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => setState({ kind: "idle" })}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      disabled={state.confirmText !== "LIBERAR"}
                      onClick={() => handleRelease(p.id)}
                    >
                      {t("confirm")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  disabled={!p.owner_wallet || p.funded_usdc <= 0}
                  onClick={() =>
                    setState({ kind: "confirm", propertyId: p.id, confirmText: "" })
                  }
                >
                  {t("releaseButton")}
                </Button>
              )}
            </div>
          );
        })}
      </section>

      {done.length > 0 && (
        <section className={styles.doneSection}>
          <h2 className={styles.sectionTitle}>{t("already")}</h2>
          {done.map((p) => (
            <div key={p.id} className={styles.cardCompact}>
              <StatePill state={p.state} />
              <span>
                {p.barrio}, {p.ciudad}
              </span>
              <span className={styles.mono}>
                {formatUsdc(p.funded_usdc)} USDC
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
