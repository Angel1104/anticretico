/**
 * Stellar network constants. Testnet only for the MVP.
 * Changing to mainnet is a post-pilot product decision, not a config twist.
 */
export const STELLAR_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const STELLAR_HORIZON_URL = "https://horizon-testnet.stellar.org";
export const EXPLORER_BASE = "https://stellar.expert/explorer/testnet";

/**
 * Escrow stub account for the hackathon demo.
 *
 * In production this is replaced by a Trustless Work escrow contract per property.
 * For the MVP demo we use a single controlled SRL testnet account as the holding
 * escrow for all properties. The secret key is held in Vercel env (never committed).
 * See canon/architecture.md for the integration path.
 */
export const ESCROW_STUB_PUBLIC =
  process.env.NEXT_PUBLIC_ESCROW_STUB_PUBLIC ??
  "GAMZIJKMZMJMGPN5QRQUPGCFG4O3X2A74XSOCYJPV6X4KUZ2JXMMXYUP";

/**
 * MVP uses native Stellar XLM as the "USDC" asset on testnet. Stellar's testnet
 * does not have a canonical USDC issuer, so issuing our own test asset would add
 * trustline friction. The UI labels the amount as USDC with the mandatory testnet
 * banner. A post-pilot epic swaps to a real USDC testnet issuer + trustlines.
 */
export const DEPOSIT_ASSET = "native" as const;
