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

export async function isFreighterInstalled(): Promise<boolean> {
  try {
    const res = await freighterIsConnected();
    return res.isConnected === true;
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<WalletConnection | WalletError> {
  const installed = await isFreighterInstalled();
  if (!installed) return { kind: "not-installed" };

  try {
    const allowed = await isAllowed();
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
    return { kind: "unknown", message: e instanceof Error ? e.message : "unknown" };
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
