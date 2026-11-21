import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { Nav, PropertyCard, RealtimeRefresh } from "@/components";
import { listProperties, getFundedUsdcForProperty, countInvestorsForProperty } from "@/lib/db/properties";
import styles from "./landing.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("landing");
  const properties = await listProperties();
  const featured = properties.slice(0, 3);
  const funded = await Promise.all(
    featured.map(async (p) => ({
      property: p,
      funded: await getFundedUsdcForProperty(p.id),
      investors: await countInvestorsForProperty(p.id),
    })),
  );

  return (
    <>
      <RealtimeRefresh />
      <Nav variant="public" />
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>{t("hero.title")}</h1>
          <p className={styles.heroSubtitle}>{t("hero.subtitle")}</p>
          <div className={styles.heroCtas}>
            <Link href="/propiedades" className={styles.ctaPrimary}>
              {t("hero.ctaPrimary")}
            </Link>
            <Link href="/propiedades" className={styles.ctaSecondary}>
              {t("hero.ctaSecondary")}
            </Link>
          </div>
        </section>

        <section className={styles.how}>
          <h2 className={styles.sectionTitle}>{t("how.title")}</h2>
          <ol className={styles.steps}>
            {t.raw("how.steps").map((step: string, i: number) => (
              <li key={i} className={styles.step}>
                <span className={styles.stepNumber}>{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.featured}>
          <h2 className={styles.sectionTitle}>{t("featured.title")}</h2>
          <div className={styles.grid}>
            {funded.map(({ property, funded, investors }) => (
              <PropertyCard
                key={property.id}
                property={property}
                funded={funded}
                investors={investors}
              />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
