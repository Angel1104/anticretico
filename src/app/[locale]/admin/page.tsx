import { getTranslations, setRequestLocale } from "next-intl/server";
import { Nav, TestnetBanner } from "@/components";
import { listPropertiesWithFunding } from "@/lib/admin/queries";
import { AdminPanel } from "@/components/AdminPanel/AdminPanel";
import styles from "./admin.module.css";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("admin");
  const rows = await listPropertiesWithFunding();

  return (
    <>
      <TestnetBanner />
      <Nav />
      <main className={styles.main}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.subtitle}>{t("subtitle")}</p>
        <AdminPanel properties={rows} />
      </main>
    </>
  );
}
