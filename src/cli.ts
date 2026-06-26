#!/usr/bin/env node
/**
 * ad-scout CLI entry point.
 *
 * Usage:
 *   ad-scout <brand> [options]
 *
 * Modes:
 *   default   needs META_ACCESS_TOKEN + ANTHROPIC_API_KEY → live fetch + analyze
 *   --demo    needs only ANTHROPIC_API_KEY → analyzes bundled sample-ads.json
 *   --offline NO keys needed → prints examples/sample-report.md instantly
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import "dotenv/config";

import { fetchAds } from "./meta.js";
import { analyzeAds } from "./analyze.js";
import { renderReport } from "./report.js";
import type { Ad } from "./types.js";

// Resolve __dirname in ESM
const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Arg parsing ────────────────────────────────────────────────────────────

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    country: { type: "string", short: "c", default: "US" },
    limit:   { type: "string", short: "l", default: "20" },
    demo:    { type: "boolean", default: false },
    offline: { type: "boolean", default: false },
    out:     { type: "string",  short: "o" },
    help:    { type: "boolean", short: "h", default: false },
  },
  allowPositionals: true,
});

// ─── Help ────────────────────────────────────────────────────────────────────

if (values.help) {
  console.log(`
ad-scout — AI-powered competitor ad intelligence

USAGE
  ad-scout <brand> [options]

OPTIONS
  --country, -c  <code>   ISO country code for ad search (default: US)
  --limit,   -l  <n>      Max ads to fetch (default: 20, max: 100)
  --demo                  Analyze bundled sample ads (needs ANTHROPIC_API_KEY only)
  --offline               Print a pre-built example report (no API keys needed)
  --out,     -o  <file>   Write report to a file instead of stdout
  --help,    -h           Show this help message

MODES
  default   Needs META_ACCESS_TOKEN + ANTHROPIC_API_KEY
            Fetches live ads from Meta Ad Library and analyzes with Claude.

  --demo    Needs ANTHROPIC_API_KEY only
            Analyzes bundled sample-ads.json. Great for testing the AI pipeline.

  --offline No keys needed
            Prints a pre-built example report instantly. Perfect for a quick look.

EXAMPLES
  ad-scout glossier                         # live mode
  ad-scout "rhode skin" --country GB        # UK ads
  ad-scout acme --demo                      # sample ads, real Claude analysis
  ad-scout acme --offline                   # instant demo, no keys
  ad-scout glossier --out report.md         # save to file

ENV VARS
  META_ACCESS_TOKEN    Facebook User Access Token (ads_read permission)
  ANTHROPIC_API_KEY    Anthropic API key (get one at console.anthropic.com)
`);
  process.exit(0);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // ── Offline mode: just print the example report ──────────────────────────
  if (values.offline) {
    // Try dist-relative path first, then src-relative (for tsx/ts-node)
    const candidates = [
      resolve(__dirname, "../examples/sample-report.md"),
      resolve(__dirname, "../../examples/sample-report.md"),
    ];

    let reportPath: string | undefined;
    for (const p of candidates) {
      if (existsSync(p)) {
        reportPath = p;
        break;
      }
    }

    if (!reportPath) {
      console.error("Error: could not find examples/sample-report.md");
      process.exit(1);
    }

    const report = readFileSync(reportPath, "utf8");
    output(report, values.out);
    return;
  }

  // ── Require a brand name for all other modes ──────────────────────────────
  const brand = positionals[0];
  if (!brand) {
    console.error(
      "Error: please provide a brand name.\n" +
      "  ad-scout <brand> [options]\n" +
      "  ad-scout --help  for full usage"
    );
    process.exit(1);
  }

  const limit = parseInt(values.limit ?? "20", 10);
  if (isNaN(limit) || limit < 1) {
    console.error("Error: --limit must be a positive integer");
    process.exit(1);
  }

  let ads: Ad[];

  // ── Demo mode: use bundled sample ads ────────────────────────────────────
  if (values.demo) {
    const candidates = [
      resolve(__dirname, "../data/sample-ads.json"),
      resolve(__dirname, "../../data/sample-ads.json"),
    ];

    let dataPath: string | undefined;
    for (const p of candidates) {
      if (existsSync(p)) {
        dataPath = p;
        break;
      }
    }

    if (!dataPath) {
      console.error("Error: could not find data/sample-ads.json");
      process.exit(1);
    }

    ads = JSON.parse(readFileSync(dataPath, "utf8")) as Ad[];
    console.error(`[ad-scout] Demo mode: loaded ${ads.length} sample ads from data/sample-ads.json`);
  } else {
    // ── Live mode: fetch from Meta Ad Library ──────────────────────────────
    console.error(`[ad-scout] Fetching ads for "${brand}" (country: ${values.country}, limit: ${limit})...`);

    try {
      ads = await fetchAds({
        brand,
        country: values.country ?? "US",
        limit,
      });
      console.error(`[ad-scout] Fetched ${ads.length} ads.`);
    } catch (err) {
      console.error(`\nError: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  // ── Run the Claude analysis pipeline ─────────────────────────────────────
  let analysis;
  try {
    analysis = await analyzeAds(brand, ads);
  } catch (err) {
    console.error(`\nError: ${(err as Error).message}`);
    process.exit(1);
  }

  // ── Render and output the report ──────────────────────────────────────────
  const report = renderReport(analysis);
  output(report, values.out);
}

/** Print to stdout or write to file. */
function output(content: string, filePath?: string): void {
  if (filePath) {
    const resolved = resolve(filePath);
    writeFileSync(resolved, content, "utf8");
    console.error(`\n[ad-scout] Report written to: ${resolved}`);
  } else {
    console.log(content);
  }
}

main().catch((err) => {
  console.error(`\nUnexpected error: ${(err as Error).message}`);
  process.exit(1);
});
