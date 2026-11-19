import styles from "./ExplorerLink.module.css";

/**
 * Explorer base URL is a MODULE CONSTANT, not env-driven.
 * Changing it to mainnet is a product decision (post-pilot epic),
 * not a config twist. AC-4 enforces this invariant.
 */
const EXPLORER_BASE = "https://stellar.expert/explorer/testnet" as const;

export type ExplorerLinkProps = {
  kind: "tx" | "account";
  value: string;
};

function truncate(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function StellarLogo() {
  return (
    <svg
      data-icon="stellar"
      viewBox="0 0 32 32"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M27 7.33 23.9 8.89l-18.78 9.41-.12-2.48 20.1-10.07a12.39 12.39 0 0 0 .26-1.25A13 13 0 0 0 3 15.68l-.03 1.5L0 18.66l.09 2.36 2.9-1.45L5 18.41l2.27-1.14.1 2.48L2.29 22.3l.09 2.36 4.86-2.44.1 2.48L5 25.76l.09 2.36 2.4-1.2 18.78-9.41.12 2.48L6.55 30.06c-.1.41-.17.84-.23 1.27a13 13 0 0 0 22.49-11.62l.03-1.5L32 16.62l-.09-2.36-2.9 1.45L27 16.89l-2.27 1.14-.1-2.48 4.86-2.44-.09-2.36-4.86 2.44-.1-2.48 2.47-1.23-.1-2.36Z"
      />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      data-icon="external"
      viewBox="0 0 14 14"
      width={14}
      height={14}
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 2H2v10h10V9 M8 2h4v4 M6 8l6-6"
      />
    </svg>
  );
}

export function ExplorerLink({ kind, value }: ExplorerLinkProps) {
  const href = `${EXPLORER_BASE}/${kind}/${value}`;
  const label = truncate(value);

  return (
    <a
      className={styles.chip}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={value}
    >
      <StellarLogo />
      <span className={styles.value}>{label}</span>
      <ExternalIcon />
    </a>
  );
}
