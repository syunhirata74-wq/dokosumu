/**
 * Affiliate URL builder.
 *
 * Returns the raw URL until ASP (e.g. A8.net) IDs are configured via
 * environment variables. Once set, all links in the app update without
 * code changes.
 *
 * Env vars (all optional):
 *   - AFFILIATE_A8_SUUMO_ID
 *   - AFFILIATE_A8_HOMES_ID
 *   - AFFILIATE_A8_ATHOME_ID
 *   - AFFILIATE_A8_CHINTAI_ID
 *
 * These are server-side only — do NOT prefix with NEXT_PUBLIC_ to keep
 * the ASP IDs out of client bundles.
 */

export type AffiliateProvider = "suumo" | "homes" | "athome" | "chintai";

const A8_IDS: Record<AffiliateProvider, string | undefined> = {
  suumo: process.env.AFFILIATE_A8_SUUMO_ID,
  homes: process.env.AFFILIATE_A8_HOMES_ID,
  athome: process.env.AFFILIATE_A8_ATHOME_ID,
  chintai: process.env.AFFILIATE_A8_CHINTAI_ID,
};

/** Wrap a raw URL in an A8.net tracking redirect, or return it unchanged if no ID is set. */
export function affUrl(provider: AffiliateProvider, rawUrl: string): string {
  const id = A8_IDS[provider];
  if (!id) return rawUrl;
  return `https://px.a8.net/svt/ejp?a8mat=${encodeURIComponent(id)}&a8ejpredirect=${encodeURIComponent(rawUrl)}`;
}

const PREF_TO_SUUMO: Record<string, string> = {
  "東京都": "tokyo",
  "神奈川県": "kanagawa",
  "埼玉県": "saitama",
  "千葉県": "chiba",
};

/** Build search URLs for each provider for a given station. */
export function buildSearchUrls(stationName: string, stationCode: string, pref: string) {
  const prefSlug = PREF_TO_SUUMO[pref] ?? "tokyo";
  const encName = encodeURIComponent(stationName + "駅");
  return {
    suumo: affUrl(
      "suumo",
      `https://suumo.jp/chintai/${prefSlug}/ek_${stationCode}/`
    ),
    homes: affUrl(
      "homes",
      `https://www.homes.co.jp/chintai/?keyword=${encName}`
    ),
    athome: affUrl(
      "athome",
      `https://www.athome.co.jp/chintai/station/?searchText=${encName}`
    ),
    chintai: affUrl(
      "chintai",
      `https://www.chintai.net/search/result/?stationText=${encName}`
    ),
  };
}
