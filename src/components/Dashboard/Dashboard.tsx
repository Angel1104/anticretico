"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ExplorerLink } from "../ExplorerLink/ExplorerLink";
import { PropertyCard } from "../PropertyCard/PropertyCard";
import { supabase } from "@/lib/db/supabase";
import type { Position, Property } from "@/lib/db/types";
import styles from "./Dashboard.module.css";

const STORAGE_KEY = "anticretico:wallet";

type Distribution = {
  id: string;
  property_id: string;
  period_month: string;
  gross_usdc: number;
  fee_usdc: number;
  net_usdc: number;
  holders_count: number;
  stellar_tx: string;
  created_at: string;
};

type PositionRow = {
  position: Position;
  property: Property;
  funded: number;
  investors: number;
};

type DistributionRow = {
  distribution: Distribution;
  property: Property;
  amountUsdc: number;
};

type DashboardData = {
  positions: PositionRow[];
  distributions: DistributionRow[];
};

const EMPTY_DATA: DashboardData = { positions: [], distributions: [] };

function wasCreatedBy(position: Position, timestamp: string): boolean {
  return new Date(position.created_at).getTime() <= new Date(timestamp).getTime();
}

export async function loadDashboardData(wallet: string): Promise<DashboardData> {
  const { data: walletPositionsData, error: walletPositionsError } = await supabase
    .from("positions")
    .select("*")
    .eq("investor_wallet", wallet);

  if (walletPositionsError) throw walletPositionsError;

  const walletPositions = (walletPositionsData ?? []) as Position[];
  if (walletPositions.length === 0) return EMPTY_DATA;

  const propertyIds = [...new Set(walletPositions.map((position) => position.property_id))];
  const [propertiesResult, distributionsResult, allPositionsResult] = await Promise.all([
    supabase.from("properties").select("*").in("id", propertyIds),
    supabase.from("distributions").select("*").in("property_id", propertyIds),
    supabase.from("positions").select("*").in("property_id", propertyIds),
  ]);

  if (propertiesResult.error) throw propertiesResult.error;
  if (distributionsResult.error) throw distributionsResult.error;
  if (allPositionsResult.error) throw allPositionsResult.error;

  const properties = (propertiesResult.data ?? []) as Property[];
  const distributions = (distributionsResult.data ?? []) as Distribution[];
  const allPositions = (allPositionsResult.data ?? []) as Position[];
  const propertyById = new Map(properties.map((property) => [property.id, property]));

  const positionRows = walletPositions
    .map((position): PositionRow | null => {
      const property = propertyById.get(position.property_id);
      if (!property) return null;

      const propertyPositions = allPositions.filter(
        (candidate) => candidate.property_id === position.property_id,
      );
      return {
        position,
        property,
        funded: propertyPositions.reduce(
          (total, candidate) => total + candidate.usdc_invested,
          0,
        ),
        investors: new Set(propertyPositions.map((candidate) => candidate.investor_wallet)).size,
      };
    })
    .filter((row): row is PositionRow => row !== null)
    .sort(
      (left, right) =>
        new Date(right.position.created_at).getTime() -
        new Date(left.position.created_at).getTime(),
    );

  const distributionRows = distributions
    .map((distribution): DistributionRow | null => {
      const property = propertyById.get(distribution.property_id);
      if (!property) return null;

      const eligiblePositions = allPositions.filter(
        (position) =>
          position.property_id === distribution.property_id &&
          wasCreatedBy(position, distribution.created_at),
      );
      const totalInvested = eligiblePositions.reduce(
        (total, position) => total + position.usdc_invested,
        0,
      );
      const walletInvested = eligiblePositions
        .filter((position) => position.investor_wallet === wallet)
        .reduce((total, position) => total + position.usdc_invested, 0);

      if (totalInvested === 0 || walletInvested === 0) return null;

      return {
        distribution,
        property,
        amountUsdc: Math.floor(
          (distribution.net_usdc * walletInvested) / totalInvested,
        ),
      };
    })
    .filter((row): row is DistributionRow => row !== null)
    .sort(
      (left, right) =>
        new Date(right.distribution.period_month).getTime() -
        new Date(left.distribution.period_month).getTime(),
    );

  return { positions: positionRows, distributions: distributionRows };
}

export function DashboardContent() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const [wallet, setWallet] = useState<string | null | undefined>(undefined);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const savedWallet = window.localStorage.getItem(STORAGE_KEY);
    setWallet(savedWallet);

    if (!savedWallet) return;

    let cancelled = false;
    void loadDashboardData(savedWallet)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setData(EMPTY_DATA);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const numberLocale = locale === "es-BO" ? "es-BO" : "en-US";
  const formatUsdc = (amount: number) =>
    `${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 }).format(amount)} USDC`;
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(numberLocale).format(new Date(`${value}T00:00:00`));

  const totalInvested =
    data?.positions.reduce(
      (total, row) => total + row.position.usdc_invested,
      0,
    ) ?? 0;
  const distributionsReceived =
    data?.distributions.reduce((total, row) => total + row.amountUsdc, 0) ?? 0;

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.subtitle}>{t("subtitle")}</p>

      {wallet === null && (
        <section className={styles.notice}>
          <h2 className={styles.noticeTitle}>{t("connectWallet")}</h2>
          <p className={styles.noticeBody}>{t("connectWalletBody")}</p>
        </section>
      )}

      {wallet && data && (
        <>
          <section className={styles.summary} aria-label={t("title")}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t("totalInvested")}</span>
              <strong className={styles.money}>{formatUsdc(totalInvested)}</strong>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t("positionsCount")}</span>
              <strong className={styles.count}>{data.positions.length}</strong>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t("distributionsReceived")}</span>
              <div className={styles.moneyLine}>
                <strong className={styles.money}>{formatUsdc(distributionsReceived)}</strong>
                <span className={styles.variable}>{t("variable")}</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t("myPositions")}</h2>
            {data.positions.length === 0 ? (
              <div className={styles.empty}>{t("noPositions")}</div>
            ) : (
              <div className={styles.positions}>
                {data.positions.map(({ position, property, funded, investors }) => (
                  <article className={styles.position} key={position.id}>
                    <PropertyCard
                      property={property}
                      funded={funded}
                      investors={investors}
                      compact
                    />
                    <div className={styles.positionMeta}>
                      <div>
                        <span className={styles.metaLabel}>{t("amount")}</span>
                        <strong className={styles.metaValue}>
                          {formatUsdc(position.usdc_invested)}
                        </strong>
                      </div>
                      <ExplorerLink kind="tx" value={position.deposited_tx} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {data.positions.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>{t("distributionHistory")}</h2>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t("date")}</th>
                      <th>{t("property")}</th>
                      <th>{t("amount")}</th>
                      <th>{t("transaction")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.distributions.map(({ distribution, property, amountUsdc }) => (
                      <tr key={distribution.id}>
                        <td>{formatDate(distribution.period_month)}</td>
                        <td>
                          {property.barrio}, {property.ciudad}
                        </td>
                        <td>{formatUsdc(amountUsdc)}</td>
                        <td>
                          <ExplorerLink kind="tx" value={distribution.stellar_tx} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
