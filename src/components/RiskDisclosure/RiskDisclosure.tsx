import styles from "./RiskDisclosure.module.css";
import { useTranslations } from "next-intl";

export type RiskCopyKey = "investVariableYield" | "investTestnet";

export type RiskDisclosureProps = {
  copyKey: RiskCopyKey;
};

export function RiskDisclosure({ copyKey }: RiskDisclosureProps) {
  const t = useTranslations("risk");
  return (
    <div className={styles.box} role="note">
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        width={20}
        height={20}
        aria-hidden="true"
      >
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3 2 20h20L12 3Z M12 10v5 M12 17.5v.5"
        />
      </svg>
      <p className={styles.text}>{t(copyKey)}</p>
    </div>
  );
}
