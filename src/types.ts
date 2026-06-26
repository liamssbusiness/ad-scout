/**
 * Core types for ad-scout.
 * These represent the data flowing through the pipeline:
 * raw Meta Ad Library response → Ad[] → AdInsight[] → Analysis → Markdown report.
 */

/** A single ad from the Meta Ad Library (or sample data). */
export interface Ad {
  id: string;
  page_name: string;
  ad_creative_bodies?: string[];   // ad copy / body text
  ad_creative_link_titles?: string[];
  ad_creative_link_captions?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_end_time?: string;
  currency?: string;
  spend?: {
    lower_bound?: string;
    upper_bound?: string;
  };
  impressions?: {
    lower_bound?: string;
    upper_bound?: string;
  };
  ad_snapshot_url?: string;
}

/** Per-ad analysis extracted by Claude Haiku (stage 1). */
export interface AdInsight {
  ad_id: string;
  page_name: string;
  ad_copy: string;       // the raw copy we analyzed
  hook: string;          // the opening hook / attention grab
  angle: string;         // the persuasion angle (fear, desire, social proof, etc.)
  offer: string;         // the specific offer or CTA
  format: string;        // image, video, carousel, UGC, etc. (inferred from copy)
}

/** Final strategic analysis synthesized by Claude Sonnet (stage 2). */
export interface Analysis {
  brand: string;
  ads_analyzed: number;
  ad_insights: AdInsight[];
  common_hooks: string[];
  dominant_angles: string[];
  offer_patterns: string[];
  format_mix: string[];
  gaps: string[];
  recommendations: string[];
  summary: string;
}
