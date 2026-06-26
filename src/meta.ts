/**
 * Meta Ad Library API client.
 *
 * Docs: https://www.facebook.com/ads/library/api/
 * Requires a Facebook User Access Token with ads_read permission.
 * Set the META_ACCESS_TOKEN environment variable before calling fetchAds().
 */

import { Ad } from "./types.js";

export interface FetchAdsOptions {
  brand: string;        // search term (brand name or page name)
  country: string;      // ISO country code, e.g. "US"
  limit: number;        // max ads to return (capped at 100 by the API per page)
}

const BASE_URL = "https://graph.facebook.com/v19.0/ads_archive";

/**
 * Fetch ads from the Meta Ad Library for a given brand/search term.
 * Returns an array of Ad objects, sorted by delivery start time (newest first).
 *
 * Throws descriptive errors for common failure modes so the CLI can surface
 * them cleanly instead of crashing with a raw API error.
 */
export async function fetchAds(opts: FetchAdsOptions): Promise<Ad[]> {
  const token = process.env.META_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "META_ACCESS_TOKEN is not set.\n" +
      "Get a token at https://developers.facebook.com/tools/explorer/ " +
      "(requires ads_read permission), then:\n" +
      "  export META_ACCESS_TOKEN=your_token_here\n\n" +
      "Tip: run with --demo to analyze sample ads using only ANTHROPIC_API_KEY,\n" +
      "     or --offline to see a pre-built report with no keys at all."
    );
  }

  const fields = [
    "id",
    "page_name",
    "ad_creative_bodies",
    "ad_creative_link_titles",
    "ad_creative_link_captions",
    "ad_delivery_start_time",
    "ad_delivery_end_time",
    "currency",
    "spend",
    "impressions",
    "ad_snapshot_url",
  ].join(",");

  const params = new URLSearchParams({
    search_terms: opts.brand,
    ad_reached_countries: `["${opts.country}"]`,
    ad_active_status: "ALL",
    fields,
    limit: String(Math.min(opts.limit, 100)),
    access_token: token,
  });

  const url = `${BASE_URL}?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(
      `Network error contacting Meta Ad Library: ${(err as Error).message}\n` +
      "Check your internet connection and try again."
    );
  }

  const json = (await response.json()) as {
    data?: Ad[];
    error?: { message: string; code: number; type: string };
    paging?: unknown;
  };

  if (!response.ok || json.error) {
    const msg = json.error?.message ?? `HTTP ${response.status}`;
    const code = json.error?.code;

    if (code === 190 || code === 102) {
      throw new Error(
        `Meta API: invalid or expired access token (code ${code}).\n` +
        "Generate a fresh token at https://developers.facebook.com/tools/explorer/"
      );
    }
    if (code === 4 || code === 17) {
      throw new Error(
        `Meta API: rate limit hit (code ${code}). Wait a few minutes and try again.`
      );
    }
    throw new Error(`Meta API error: ${msg}`);
  }

  const ads = json.data ?? [];

  if (ads.length === 0) {
    throw new Error(
      `No ads found for "${opts.brand}" in country "${opts.country}".\n` +
      "Try a broader search term, a different country, or check the brand name spelling.\n" +
      "Use --demo to analyze sample ads without needing Meta API access."
    );
  }

  return ads;
}
