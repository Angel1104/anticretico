"use client";

import styles from "./Nav.module.css";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { connectWallet } from "@/lib/stellar/wallet";

export type NavProps = {
  variant?: "public" | "app";
};

const STORAGE_KEY = "anticretico:wallet";

export function Nav({ variant = "app" }: NavProps) {
  const t = useTranslations("nav");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setPublicKey(saved);
  }, []);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    const conn = await connectWallet();
    setConnecting(false);
    if ("kind" in conn) {
      const map: Record<string, string> = {
        "not-installed": "Instalá Freighter desde freighter.app",
        "wrong-network": "Cambiá Freighter a Testnet",
        "user-rejected": "Conexión cancelada",
        unknown: "Error desconocido",
      };
      setError(map[conn.kind] ?? "Error");
      return;
    }
    setPublicKey(conn.publicKey);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, conn.publicKey);
    }
  }

  function handleDisconnect() {
    setPublicKey(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.brand}>
        Anticretico
      </Link>
      <div className={styles.links}>
        {variant === "app" && (
          <>
            <Link href="/propiedades" className={styles.link}>
              {t("propiedades")}
            </Link>
            <Link href="/dashboard" className={styles.link}>
              {t("dashboard")}
            </Link>
            <Link href="/owner" className={styles.link}>
              {t("owner")}
            </Link>
            <Link href="/admin" className={styles.link}>
              {t("admin")}
            </Link>
          </>
        )}
      </div>
      <div className={styles.right}>
        {publicKey ? (
          <button
            className={styles.cta}
            type="button"
            onClick={handleDisconnect}
            title={publicKey}
          >
            {publicKey.slice(0, 6)}…{publicKey.slice(-4)}
          </button>
        ) : (
          <button
            className={styles.cta}
            type="button"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? "..." : t("connect")}
          </button>
        )}
        {error && <span className={styles.error}>{error}</span>}
      </div>
    </nav>
  );
}
