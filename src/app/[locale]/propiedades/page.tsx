import { getTranslations, setRequestLocale } from "next-intl/server";
import { Nav, PropertyCard, TestnetBanner } from "@/components";
import { listProperties, getFundedUsdcForProperty, countInvestorsForProperty } from "@/lib/db/properties";
import styles from "./catalog.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CatalogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("catalog");
  const properties = await listProperties();
  const enriched = await Promise.all(
    properties.map(async (p) => ({
      property: p,
      funded: await getFundedUsdcForProperty(p.id),
      investors: await countInvestorsForProperty(p.id),
    })),
  );

  return (
    <>
      <TestnetBanner />
      <Nav />
      <main className={styles.main}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.subtitle}>{t("subtitle", { count: properties.length })}</p>
        {enriched.length === 0 ? (
          <p className={styles.empty}>{t("empty")}</p>
        ) : (
          <div className={styles.grid}>
            {enriched.map(({ property, funded, investors }) => (
              <PropertyCard
                key={property.id}
                property={property}
                funded={funded}
                investors={investors}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
