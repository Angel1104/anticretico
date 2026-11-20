import { getTranslations, setRequestLocale } from "next-intl/server";
import { Nav, TestnetBanner } from "@/components";
import { OwnerPanel } from "@/components/OwnerPanel/OwnerPanel";
import styles from "./owner.module.css";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function OwnerPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner");

  return (
    <>
      <TestnetBanner />
      <Nav />
      <main className={styles.main}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.subtitle}>{t("subtitle")}</p>
        <OwnerPanel />
      </main>
    </>
  );
}
