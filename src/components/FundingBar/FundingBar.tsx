import styles from "./FundingBar.module.css";
import { useTranslations } from "next-intl";

export type FundingBarProps = {
  funded: number;
  target: number;
  investors?: number;
  daysLeft?: number | null;
  size?: "sm" | "lg";
};

function formatUsdc(amount: number): string {
  return new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 }).format(amount);
}

export function FundingBar({
  funded,
  target,
  investors,
  daysLeft,
  size = "sm",
}: FundingBarProps) {
  const t = useTranslations("fundingBar");
  const pct = Math.min(100, Math.max(0, target === 0 ? 0 : (funded / target) * 100));
  const fullyFunded = pct >= 100;

  return (
    <div className={`${styles.wrap} ${styles[`s_${size}`]}`}>
      <div className={styles.labels}>
        {fullyFunded ? (
          <span className={styles.full}>{t("fullyFunded")}</span>
        ) : (
          <>
            <span>{t("funded", { amount: formatUsdc(funded) })}</span>
            <span className={styles.target}>
              {t("ofTarget", { target: formatUsdc(target) })}
            </span>
          </>
        )}
      </div>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {(typeof investors === "number" || daysLeft != null) && (
        <div className={styles.caption}>
          {typeof investors === "number" && (
            <span>{t("investors", { count: investors })}</span>
          )}
          {daysLeft != null && !fullyFunded && (
            <span>{t("daysLeft", { days: daysLeft })}</span>
          )}
        </div>
      )}
    </div>
  );
}
