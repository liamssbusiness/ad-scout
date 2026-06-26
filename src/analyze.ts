/**
 * Two-stage Claude pipeline for ad analysis.
 *
 * Stage 1 (Haiku) — fast, cheap, runs per-ad:
 *   Extract structured {hook, angle, offer, format} from each ad's copy.
 *
 * Stage 2 (Sonnet) — runs once over all per-ad insights:
 *   Synthesize strategic patterns, gaps, and recommendations.
 *
 * Client is initialized lazily so a missing ANTHROPIC_API_KEY only errors
 * when you actually try to analyze, not at import time.
 */

import Anthropic from "@anthropic-ai/sdk";
import { Ad, AdInsight, Analysis } from "./types.js";

// Lazy client — initialized on first use.
let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (_client) return _client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set.\n" +
      "Get your key at https://console.anthropic.com/keys, then:\n" +
      "  export ANTHROPIC_API_KEY=sk-ant-...\n\n" +
      "Tip: run with --offline to see a pre-built report with no keys at all."
    );
  }

  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Strip markdown code fences from a string before JSON.parse.
 * Claude sometimes wraps JSON in ```json ... ``` even when instructed not to.
 */
function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

/**
 * Pull the best available text out of an ad for analysis.
 * Prefers body copy, falls back to link title, then caption.
 */
function extractAdCopy(ad: Ad): string {
  const parts: string[] = [];

  if (ad.ad_creative_bodies?.length) {
    parts.push(...ad.ad_creative_bodies);
  }
  if (ad.ad_creative_link_titles?.length) {
    parts.push(...ad.ad_creative_link_titles);
  }
  if (ad.ad_creative_link_captions?.length) {
    parts.push(...ad.ad_creative_link_captions);
  }

  const combined = parts.join(" | ").trim();
  if (!combined) {
    return "[No ad copy available — creative may be image/video only]";
  }
  // Truncate very long copies to keep token usage reasonable
  return combined.length > 800 ? combined.slice(0, 800) + "…" : combined;
}

/**
 * Stage 1: Use claude-haiku-4-5 to extract structured insight from a single ad.
 * Returns a partial AdInsight (without ad_id / page_name, which we add after).
 */
async function extractInsight(
  client: Anthropic,
  adCopy: string
): Promise<{ hook: string; angle: string; offer: string; format: string }> {
  const prompt = `You are an expert direct-response advertising analyst.

Analyze this ad copy and extract the following in valid JSON (no markdown fences, no extra text):
{
  "hook":   "The opening line or attention-grabbing element",
  "angle":  "The core persuasion angle (e.g. social proof, fear of missing out, aspirational, problem/solution, urgency, curiosity, authority)",
  "offer":  "The specific offer, discount, or CTA mentioned (or 'Not specified' if none)",
  "format": "The likely ad format based on copy style (e.g. image, video, UGC, carousel, testimonial, before/after)"
}

Ad copy:
${adCopy}

Respond with ONLY the JSON object. No explanation.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (message.content[0] as { type: string; text: string }).text;
  const cleaned = stripCodeFences(raw);

  try {
    return JSON.parse(cleaned) as {
      hook: string;
      angle: string;
      offer: string;
      format: string;
    };
  } catch {
    // Graceful fallback if Haiku returns something unparseable
    return {
      hook: adCopy.slice(0, 80),
      angle: "Unknown",
      offer: "Not specified",
      format: "Unknown",
    };
  }
}

/**
 * Stage 2: Use claude-sonnet-4-5 to synthesize strategic insights across all ads.
 */
async function synthesize(
  client: Anthropic,
  brand: string,
  insights: AdInsight[]
): Promise<{
  common_hooks: string[];
  dominant_angles: string[];
  offer_patterns: string[];
  format_mix: string[];
  gaps: string[];
  recommendations: string[];
  summary: string;
}> {
  const insightsSummary = insights
    .map(
      (i, idx) =>
        `Ad ${idx + 1} (${i.page_name}):\n` +
        `  Hook: ${i.hook}\n` +
        `  Angle: ${i.angle}\n` +
        `  Offer: ${i.offer}\n` +
        `  Format: ${i.format}`
    )
    .join("\n\n");

  const prompt = `You are a senior performance marketing strategist. You've just analyzed ${insights.length} ads from "${brand}" (or their competitors).

Here are the per-ad breakdowns:

${insightsSummary}

Based on these, produce a strategic synthesis in valid JSON (no markdown fences, no extra text):
{
  "common_hooks": ["list of 3-5 hook patterns you see repeated"],
  "dominant_angles": ["list of 2-4 persuasion angles that dominate"],
  "offer_patterns": ["list of 2-4 offer/CTA patterns observed"],
  "format_mix": ["list of ad formats seen and their approximate share"],
  "gaps": ["list of 2-3 angles or formats they're NOT using that competitors often exploit"],
  "recommendations": ["list of 3-5 specific, actionable recommendations for a brand entering this space"],
  "summary": "A 2-3 sentence executive summary of the brand's ad strategy and what a new entrant should know"
}

Be specific and opinionated. This is for a marketer who will act on this today.
Respond with ONLY the JSON object. No explanation.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (message.content[0] as { type: string; text: string }).text;
  const cleaned = stripCodeFences(raw);

  return JSON.parse(cleaned) as {
    common_hooks: string[];
    dominant_angles: string[];
    offer_patterns: string[];
    format_mix: string[];
    gaps: string[];
    recommendations: string[];
    summary: string;
  };
}

/**
 * Main entry point. Takes raw ads, runs the two-stage Claude pipeline,
 * and returns a fully structured Analysis object.
 *
 * @param brand  - The brand name (used for labeling in the report)
 * @param ads    - Array of ads from Meta API or sample data
 */
export async function analyzeAds(brand: string, ads: Ad[]): Promise<Analysis> {
  const client = getClient();

  console.error(`\n[ad-scout] Stage 1: extracting insights from ${ads.length} ads with claude-haiku-4-5...`);

  // Run Haiku extractions concurrently (batch of up to 5 at a time to be API-friendly)
  const insights: AdInsight[] = [];
  const batchSize = 5;

  for (let i = 0; i < ads.length; i += batchSize) {
    const batch = ads.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (ad) => {
        const copy = extractAdCopy(ad);
        const extracted = await extractInsight(client, copy);
        return {
          ad_id: ad.id,
          page_name: ad.page_name ?? "Unknown",
          ad_copy: copy,
          ...extracted,
        } satisfies AdInsight;
      })
    );
    insights.push(...batchResults);
    process.stderr.write(`  ${Math.min(i + batchSize, ads.length)}/${ads.length} ads processed\n`);
  }

  console.error(`\n[ad-scout] Stage 2: synthesizing strategy with claude-sonnet-4-5...`);

  const synthesis = await synthesize(client, brand, insights);

  return {
    brand,
    ads_analyzed: ads.length,
    ad_insights: insights,
    ...synthesis,
  };
}
