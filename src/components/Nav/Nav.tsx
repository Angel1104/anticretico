import styles from "./Nav.module.css";
import Link from "next/link";
import { useTranslations } from "next-intl";

export type NavProps = {
  variant?: "public" | "app";
};

export function Nav({ variant = "app" }: NavProps) {
  const t = useTranslations("nav");
  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.brand}>
        Anticretico
      </Link>
      <div className={styles.links}>
        {variant === "app" && (
          <Link href="/propiedades" className={styles.link}>
            {t("propiedades")}
          </Link>
        )}
      </div>
      <div className={styles.right}>
        <button className={styles.cta} type="button">
          {t("connect")}
        </button>
      </div>
    </nav>
  );
}
