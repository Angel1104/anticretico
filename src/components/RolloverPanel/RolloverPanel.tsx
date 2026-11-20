"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./RolloverPanel.module.css";
import { useTranslations } from "next-intl";
import {
  Button,
  StatePill,
  RiskDisclosure,
  ExplorerLink,
} from "@/components";
import { rolloverHolders } from "@/lib/admin/rollover";
import type { Property } from "@/lib/db/types";

export type RolloverPanelProps = {
  sources: Property[];
  targets: Property[];
  adminWallet: string;
};

type State =
  | { kind: "idle" }
  | { kind: "selecting"; sourceId: string; targetId?: string; confirmText: string }
  | { kind: "signing" }
  | {
      kind: "done";
      hash: string;
      holdersMigrated: number;
      usdcMigrated: number;
    }
  | { kind: "error"; message: string };

function formatUsdc(n: number): string {
  return new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 }).format(n);
}

export function RolloverPanel({
  sources,
  targets,
  adminWallet,
}: RolloverPanelProps) {
  const t = useTranslations("rollover");
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function execute() {
    if (state.kind !== "selecting") return;
    if (!state.targetId) return;
    if (state.confirmText !== "ROLLOVER") return;
    setState({ kind: "signing" });
    try {
      const res = await rolloverHolders({
        sourcePropertyId: state.sourceId,
        targetPropertyId: state.targetId,
        adminWallet,
      });
      setState({
        kind: "done",
        hash: res.hash,
        holdersMigrated: res.holdersMigrated,
        usdcMigrated: res.usdcMigrated,
      });
      router.refresh();
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  if (sources.length === 0) {
    return <p className={styles.empty}>{t("noSources")}</p>;
  }

  if (state.kind === "done") {
    return (
      <div className={styles.successBox}>
        <p>
          {t("doneBody", {
            count: state.holdersMigrated,
            amount: formatUsdc(state.usdcMigrated),
          })}
        </p>
        <ExplorerLink kind="tx" value={state.hash} />
        <Button
          variant="secondary"
          size="md"
          onClick={() => setState({ kind: "idle" })}
        >
          {t("newRollover")}
        </Button>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className={styles.errorBox}>
        <p>{state.message}</p>
        <Button
          variant="secondary"
          size="md"
          onClick={() => setState({ kind: "idle" })}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (state.kind === "signing") {
    return <p className={styles.body}>{t("signing")}</p>;
  }

  const selectedSource =
    state.kind === "selecting"
      ? sources.find((s) => s.id === state.sourceId)
      : null;

  return (
    <div className={styles.wrap}>
      <div className={styles.sources}>
        <h3 className={styles.listTitle}>{t("sources")}</h3>
        {sources.map((s) => {
          const isSelected =
            state.kind === "selecting" && state.sourceId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              className={`${styles.listItem} ${isSelected ? styles.selected : ""}`}
              onClick={() =>
                setState({
                  kind: "selecting",
                  sourceId: s.id,
                  confirmText: "",
                })
              }
            >
              <StatePill state={s.state} />
              <span>
                {s.barrio}, {s.ciudad}
              </span>
            </button>
          );
        })}
      </div>

      {selectedSource && (
        <>
          <div className={styles.sources}>
            <h3 className={styles.listTitle}>{t("targets")}</h3>
            {targets.length === 0 && (
              <p className={styles.empty}>{t("noTargets")}</p>
            )}
            {targets.map((tp) => {
              const isSelected =
                state.kind === "selecting" && state.targetId === tp.id;
              return (
                <button
                  key={tp.id}
                  type="button"
                  className={`${styles.listItem} ${isSelected ? styles.selected : ""}`}
                  onClick={() =>
                    setState({
                      kind: "selecting",
                      sourceId: selectedSource.id,
                      targetId: tp.id,
                      confirmText:
                        state.kind === "selecting" ? state.confirmText : "",
                    })
                  }
                >
                  <StatePill state={tp.state} />
                  <span>
                    {tp.barrio}, {tp.ciudad}
                  </span>
                  <span className={styles.capacity}>
                    {t("capacity")}: {formatUsdc(tp.target_usdc)} USDC
                  </span>
                </button>
              );
            })}
          </div>

          {state.kind === "selecting" && state.targetId && (
            <div className={styles.confirmBox}>
              <RiskDisclosure copyKey="investTestnet" />
              <p className={styles.body}>{t("confirmBody")}</p>
              <input
                type="text"
                className={styles.input}
                placeholder="ROLLOVER"
                value={state.confirmText}
                onChange={(e) =>
                  setState({
                    kind: "selecting",
                    sourceId: state.sourceId,
                    targetId: state.targetId,
                    confirmText: e.target.value,
                  })
                }
              />
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
                  disabled={state.confirmText !== "ROLLOVER"}
                  onClick={execute}
                >
                  {t("execute")}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
