import styles from "./StatePill.module.css";
import type { PropertyState } from "@/lib/db/types";
import { useTranslations } from "next-intl";

const STATE_CLASS: Record<PropertyState, string> = {
  "En fondeo": styles.fondeo,
  "En trámite": styles.tramite,
  "Buscando inquilino": styles.buscando,
  Alquilado: styles.alquilado,
  Finalizado: styles.finalizado,
};

export type StatePillProps = {
  state: PropertyState;
};

export function StatePill({ state }: StatePillProps) {
  const t = useTranslations("state");
  return (
    <span className={`${styles.pill} ${STATE_CLASS[state]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {t(state)}
    </span>
  );
}
