"use client";

import {
  requestAccess,
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

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
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

/**
 * Connect to Freighter.
 *
 * Uses the canonical @stellar/freighter-api requestAccess() which:
 *  - triggers the extension's permission popup on first use for a new origin,
 *  - returns the chosen account's address on success,
 *  - returns an error field when the user rejects or network/host blocks it.
 *
 * Internals: the lib posts a message to the extension content script and awaits
 * a reply. We wrap every call in a timeout so a missing extension never hangs
 * the UI. The connection popup is user-driven, so we allow up to 30s there.
 */
export async function connectWallet(): Promise<WalletConnection | WalletError> {
  let access: { address?: string; error?: unknown };
  try {
    access = (await withTimeout(requestAccess(), 30_000, "requestAccess")) as {
      address?: string;
      error?: unknown;
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    if (message.startsWith("timeout:")) {
      return { kind: "not-installed" };
    }
    return { kind: "unknown", message };
  }

  if (access.error) {
    const err = access.error as { code?: number; message?: string };
    const msg = (err.message ?? "").toLowerCase();
    // Freighter uses distinct error codes/messages for "user rejected" vs
    // "extension missing"; a missing extension typically never replies at
    // all (caught by our timeout above). Any error here means the user
    // actively rejected or Freighter is in an error state.
    if (msg.includes("reject") || msg.includes("denied") || err.code === -4) {
      return { kind: "user-rejected" };
    }
    if (msg.includes("not found") || msg.includes("install")) {
      return { kind: "not-installed" };
    }
    return { kind: "unknown", message: err.message ?? "unknown" };
  }

  if (!access.address) {
    return { kind: "user-rejected" };
  }

  // Verify network. If the user has Freighter on mainnet, refuse.
  try {
    const net = await withTimeout(getNetworkDetails(), 5_000, "getNetworkDetails");
    if (net.networkPassphrase !== STELLAR_NETWORK_PASSPHRASE) {
      return { kind: "wrong-network", current: net.network };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return { kind: "unknown", message };
  }

  return { publicKey: access.address };
}

export async function signXdr(xdr: string, publicKey: string): Promise<string> {
  const res = await signTransaction(xdr, {
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    address: publicKey,
  });
  if (res.error) throw new Error(res.error.message ?? "sign failed");
  return res.signedTxXdr;
}
