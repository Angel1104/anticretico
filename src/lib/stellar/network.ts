import { Asset } from "@stellar/stellar-sdk";

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
 * USDC asset configuration.
 *
 * On Stellar testnet there is no canonical USDC issuer, so for this spike we mint
 * our own "USDC" asset from a controlled testnet issuer (see scripts/mint-usdc.ts).
 * Any account that holds or sends this USDC must first open a trustline to the
 * same (code, issuer) pair.
 *
 * NEXT_PUBLIC_USDC_CODE defaults to "USDC"; NEXT_PUBLIC_USDC_ISSUER must be set
 * for the real asset to be used. When the issuer is not configured (early local
 * dev or CI without secrets) we fall back to native XLM so the demo still boots;
 * callers that need to assert on the real asset should check `IS_USDC_CONFIGURED`.
 */
export const USDC_CODE = process.env.NEXT_PUBLIC_USDC_CODE ?? "USDC";
export const USDC_ISSUER = process.env.NEXT_PUBLIC_USDC_ISSUER ?? "";
export const IS_USDC_CONFIGURED = USDC_ISSUER.length > 0;

export const USDC_ASSET: Asset = IS_USDC_CONFIGURED
  ? new Asset(USDC_CODE, USDC_ISSUER)
  : Asset.native();

/**
 * Kept for backwards compatibility with earlier spike callers. Prefer importing
 * `USDC_ASSET` directly.
 */
export const DEPOSIT_ASSET = IS_USDC_CONFIGURED ? "usdc" : ("native" as const);
