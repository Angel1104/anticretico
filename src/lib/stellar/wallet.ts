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
 * Detect whether Freighter is actually installed.
 *
 * @stellar/freighter-api does NOT throw when the extension is absent — every
 * read function (isConnected, isAllowed) returns `{ <value>: false, error: {...} }`
 * immediately. The *write* functions (setAllowed, getAddress, signTransaction)
 * block indefinitely waiting for a content-script reply that never comes.
 *
 * So the reliable signal is: call isConnected(); if the response has an `error`
 * field, no extension is present. Treat anything else as installed.
 */
export async function isFreighterInstalled(): Promise<boolean> {
  // Sync probe first: the extension injects `window.freighter` into the page.
  // Confirmed in production: without the extension, `window.freighter` is undefined
  // and the API's isConnected() enters a hanging postMessage path. A short poll
  // (~500ms) gives the extension time to inject in case this runs very early.
  if (typeof window === "undefined") return false;
  const start = Date.now();
  while (Date.now() - start < 500) {
    if ((window as unknown as { freighter?: unknown }).freighter) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  // Still no global — confirm via API with a short timeout as a fallback.
  try {
    const res = (await withTimeout(freighterIsConnected(), 1000, "isConnected")) as {
      isConnected?: boolean;
      error?: unknown;
    };
    if (res && "error" in res && res.error) return false;
    return !!res?.isConnected;
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<WalletConnection | WalletError> {
  const installed = await isFreighterInstalled();
  if (!installed) return { kind: "not-installed" };

  try {
    const allowed = (await withTimeout(isAllowed(), 3000, "isAllowed")) as {
      isAllowed?: boolean;
      error?: unknown;
    };
    if (allowed?.error) return { kind: "not-installed" };

    if (!allowed.isAllowed) {
      const prompt = (await withTimeout(setAllowed(), 60_000, "setAllowed")) as {
        isAllowed?: boolean;
        error?: unknown;
      };
      if (prompt?.error) return { kind: "user-rejected" };
      if (!prompt.isAllowed) return { kind: "user-rejected" };
    }

    const net = await withTimeout(getNetworkDetails(), 10_000, "getNetwork");
    if (net.networkPassphrase !== STELLAR_NETWORK_PASSPHRASE) {
      return { kind: "wrong-network", current: net.network };
    }

    const addr = (await withTimeout(getAddress(), 60_000, "getAddress")) as {
      address?: string;
      error?: unknown;
    };
    if (addr?.error || !addr.address) {
      return { kind: "user-rejected" };
    }
    return { publicKey: addr.address };
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    if (message.startsWith("timeout:")) {
      return { kind: "not-installed" };
    }
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
