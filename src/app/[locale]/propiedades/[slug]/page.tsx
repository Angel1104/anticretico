import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Nav,
  TestnetBanner,
  StatePill,
  FundingBar,
  InvestFlow,
} from "@/components";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import {
  getPropertyBySlug,
  getFundedUsdcForProperty,
  countInvestorsForProperty,
} from "@/lib/db/properties";
import styles from "./detail.module.css";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

function formatUsdc(amount: number): string {
  return new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 }).format(amount);
}

export default async function PropertyDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const property = await getPropertyBySlug(slug);
  if (!property) notFound();

  const t = await getTranslations("propertyDetail");
  const tCard = await getTranslations("propertyCard");
  const funded = await getFundedUsdcForProperty(property.id);
  const investors = await countInvestorsForProperty(property.id);

  const canInvest = property.state === "En fondeo";

  return (
    <>
      <TestnetBanner />
      <Nav />
      <main className={styles.main}>
        <Link href="/propiedades" className={styles.back}>
          ← {t("back")}
        </Link>

        <div className={styles.header}>
          <StatePill state={property.state} />
          <h1 className={styles.title}>
            {property.barrio}, {property.ciudad}
          </h1>
          <p className={styles.address}>{property.address}</p>
        </div>

        <div className={styles.gallery}>
          {property.images_urls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={property.images_urls[0]} alt={property.address} />
          ) : (
            <div className={styles.placeholder} />
          )}
        </div>

        <section className={styles.anticreticoCard}>
          <h2 className={styles.cardTitle}>{t("anticretico")}</h2>
          <dl className={styles.metrics}>
            <div>
              <dt>{t("target")}</dt>
              <dd className={styles.money}>{formatUsdc(property.target_usdc)} USDC</dd>
            </div>
            <div>
              <dt>{t("funded")}</dt>
              <dd className={styles.money}>{formatUsdc(funded)} USDC</dd>
            </div>
            <div>
              <dt>{t("rentMonthly")}</dt>
              <dd>
                {tCard("rentVariable", { amount: formatUsdc(property.rent_monthly_usdc) })}
              </dd>
            </div>
            <div>
              <dt>{t("term")}</dt>
              <dd>{t("termMonths", { months: property.duration_months })}</dd>
            </div>
          </dl>

          <FundingBar
            funded={funded}
            target={property.target_usdc}
            investors={investors}
            size="lg"
          />

          <InvestFlow
            propertyId={property.id}
            propertySlug={property.slug}
            canInvest={canInvest}
          />
        </section>

        {property.description && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t("description")}</h2>
            <p className={styles.description}>{property.description}</p>
          </section>
        )}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("onchainHistory")}</h2>
          <p className={styles.description}>{t("noHistory")}</p>
        </section>
      </main>
    </>
  );
}
