import styles from "./TestnetBanner.module.css";
import { useTranslations } from "next-intl";

export function TestnetBanner() {
  const t = useTranslations();
  return <div className={styles.bar}>{t("testnetBanner")}</div>;
}
