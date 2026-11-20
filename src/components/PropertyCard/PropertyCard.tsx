import styles from "./PropertyCard.module.css";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { StatePill } from "../StatePill/StatePill";
import { FundingBar } from "../FundingBar/FundingBar";
import type { Property } from "@/lib/db/types";

export type PropertyCardProps = {
  property: Property;
  funded: number;
  investors: number;
  href?: string;
};

function formatUsdc(amount: number): string {
  return new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 }).format(amount);
}

export function PropertyCard({ property, funded, investors, href }: PropertyCardProps) {
  const t = useTranslations("propertyCard");
  const link = href ?? `/propiedades/${property.slug}`;
  const isFinalized = property.state === "Finalizado";

  return (
    <Link href={link} className={styles.card}>
      <div className={styles.image}>
        {property.images_urls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={property.images_urls[0]} alt={property.address} />
        ) : (
          <div className={styles.imagePlaceholder} />
        )}
      </div>
      <div className={styles.body}>
        <StatePill state={property.state} />
        <div className={styles.titleRow}>
          <div>
            <h3 className={styles.title}>
              {property.barrio}, {property.ciudad}
            </h3>
            <p className={styles.address}>{property.address}</p>
          </div>
          <span className={styles.chevron} aria-hidden="true">
            →
          </span>
        </div>
        <div className={styles.finance}>
          <div>
            <span className={styles.financeLabel}>{t("anticretico")}: </span>
            <span className={styles.financeValue}>
              {formatUsdc(property.target_usdc)} USDC
            </span>
          </div>
          <div>
            <span className={styles.financeLabel}>{t("rent")}: </span>
            <span className={styles.financeValue}>
              {t("rentVariable", { amount: formatUsdc(property.rent_monthly_usdc) })}
            </span>
          </div>
        </div>
        {!isFinalized && (
          <FundingBar
            funded={funded}
            target={property.target_usdc}
            investors={investors}
          />
        )}
        {isFinalized && (
          <div className={styles.finalizedNote}>{t("finalized")}</div>
        )}
        <div className={styles.footer}>
          {isFinalized ? t("viewHistory") : t("viewDetails")} →
        </div>
      </div>
    </Link>
  );
}
