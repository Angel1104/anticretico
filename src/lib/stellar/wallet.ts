"use client";

import {
  isConnected as freighterIsConnected,
  isAllowed,
  setAllowed,
  getAddress,
  getNetworkDetails,
  signTransaction,
} from "@stellar/freighter-api";
import { STELLAR_NETWORK_PASSPHRASE } from "./network";

export type WalletConnection = {
  publicKey: string;
};

export type WalletError =
  | { kind: "not-installed" }
  | { kind: "wrong-network"; current: string }
  | { kind: "user-rejected" }
  | { kind: "unknown"; message: string };

const DETECT_TIMEOUT_MS = 1500;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export async function isFreighterInstalled(): Promise<boolean> {
  // Freighter's @stellar/freighter-api hangs when the extension isn't present
  // (it posts a message and waits for a reply that never comes). A short race
  // against isConnected() is the reliable way to detect absence.
  try {
    const res = await withTimeout(freighterIsConnected(), DETECT_TIMEOUT_MS);
    // isConnected returning without timeout proves the extension is there,
    // regardless of whether the user has previously allowed this origin.
    return typeof res === "object" && res !== null;
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<WalletConnection | WalletError> {
  const installed = await isFreighterInstalled();
  if (!installed) return { kind: "not-installed" };

  try {
    const allowed = await withTimeout(isAllowed(), 10_000);
    if (!allowed.isAllowed) {
      const prompt = await setAllowed();
      if (!prompt.isAllowed) return { kind: "user-rejected" };
    }

    const net = await getNetworkDetails();
    if (net.networkPassphrase !== STELLAR_NETWORK_PASSPHRASE) {
      return { kind: "wrong-network", current: net.network };
    }

    const addr = await getAddress();
    if (addr.error || !addr.address) {
      return { kind: "user-rejected" };
    }
    return { publicKey: addr.address };
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    if (message === "timeout") return { kind: "not-installed" };
    return { kind: "unknown", message };
  }
}

export async function signXdr(xdr: string, publicKey: string): Promise<string> {
  const res = await signTransaction(xdr, {
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    address: publicKey,
  });
  if (res.error) throw new Error(res.error.message ?? "sign failed");
  return res.signedTxXdr;
}
