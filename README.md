# ad-scout

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Anthropic](https://img.shields.io/badge/Powered%20by-Claude-D97757?logo=anthropic&logoColor=white)](https://www.anthropic.com/)
[![Meta Ad Library](https://img.shields.io/badge/Meta%20Ad%20Library-API-1877F2?logo=meta&logoColor=white)](https://www.facebook.com/ads/library/api/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**AI-powered competitor ad intelligence for marketers.** Point it at a brand, get a strategic analysis of their ads — hooks, angles, offers, format mix, gaps, and concrete recommendations — in one command.

This is something ad agencies do by hand, spending hours in the Meta Ad Library. ad-scout automates it with a two-stage Claude pipeline.

---

## Quick start

See a full example report **right now** — no API keys, no install:

```bash
npx ad-scout acme --offline
```

Or install locally and run the demo (only needs `ANTHROPIC_API_KEY`):

```bash
npm install -g ad-scout
export ANTHROPIC_API_KEY=sk-ant-...
ad-scout acme --demo
```

---

## What it does

Given a brand name, ad-scout:

1. **Fetches ads** from the [Meta Ad Library](https://www.facebook.com/ads/library/) (or uses bundled sample data in `--demo` mode)
2. **Extracts structure** from each ad using `claude-haiku-4-5` — hook, persuasion angle, offer, format
3. **Synthesizes strategy** across all ads using `claude-sonnet-4-5` — patterns, gaps, and actionable recommendations
4. **Outputs a Markdown report** you can share, save, or pipe wherever you need it

---

## Features

- **Three modes**: live (real ads), demo (sample ads, AI analysis), offline (instant, no keys)
- **Two-stage Claude pipeline**: Haiku for fast per-ad extraction, Sonnet for strategic synthesis
- **Clean Markdown output**: structured report with table, bullets, and numbered recommendations
- **File output**: `--out report.md` to save anywhere
- **Graceful error handling**: clear messages for missing tokens, rate limits, and no results

---

## How it works

```
Brand name
    │
    ▼
Meta Ad Library API ──────────────────────────────────────────────────┐
(graph.facebook.com/ads_archive)                                       │
                                                                       ▼
                                                               Ad[] (raw JSON)
                                                                       │
                                                        ┌──────────────▼──────────────┐
                                                        │     Stage 1: claude-haiku-4-5│
                                                        │  (per-ad, run concurrently)  │
                                                        │                              │
                                                        │  Ad copy → { hook, angle,    │
                                                        │              offer, format }  │
                                                        └──────────────┬──────────────┘
                                                                       │
                                                               AdInsight[]
                                                                       │
                                                        ┌──────────────▼──────────────┐
                                                        │    Stage 2: claude-sonnet-4-5│
                                                        │  (once, across all insights) │
                                                        │                              │
                                                        │  Patterns, gaps, recs,       │
                                                        │  executive summary           │
                                                        └──────────────┬──────────────┘
                                                                       │
                                                               Analysis object
                                                                       │
                                                                       ▼
                                                            Markdown report
```

**Stage 1 (Haiku)** is fast and cheap — it runs on every ad concurrently in batches of 5, extracting structured JSON. It's designed to be disposable: if it hallucinates a format field, the downstream synthesis isn't catastrophically wrong.

**Stage 2 (Sonnet)** gets the full picture and reasons across all ads at once, producing the strategic layer that's actually useful to a marketer.

---

## Usage

```bash
ad-scout <brand> [options]
```

### Flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--country` | `-c` | `US` | ISO country code for the Meta Ad Library search |
| `--limit` | `-l` | `20` | Max ads to fetch (1–100) |
| `--demo` | | false | Use bundled sample ads (no Meta token needed) |
| `--offline` | | false | Print pre-built example report (no keys needed) |
| `--out` | `-o` | — | Write report to a file instead of stdout |
| `--help` | `-h` | — | Show help |

### Examples

```bash
# Live mode — analyze real Glossier ads in the US
ad-scout glossier

# UK market research
ad-scout "rhode skin" --country GB

# Analyze 50 ads (more context = better synthesis)
ad-scout glossier --limit 50

# Demo mode — real Claude analysis, no Meta token needed
ad-scout acme --demo

# Offline mode — instant, no keys, great for a quick look
ad-scout acme --offline

# Save report to a file
ad-scout glossier --out glossier-report.md
```

---

## Modes

| Mode | Command | Keys needed | What happens |
|------|---------|-------------|--------------|
| **Live** | `ad-scout <brand>` | `META_ACCESS_TOKEN` + `ANTHROPIC_API_KEY` | Fetches real ads from Meta, analyzes with Claude |
| **Demo** | `ad-scout <brand> --demo` | `ANTHROPIC_API_KEY` only | Analyzes bundled `data/sample-ads.json` with real Claude pipeline |
| **Offline** | `ad-scout <brand> --offline` | None | Prints `examples/sample-report.md` instantly |

> **Note on live mode**: The Meta Ad Library API requires a Facebook User Access Token with `ads_read` permission. These tokens expire; generate a fresh one at [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer/) when needed.

---

## Environment variables

| Variable | Required for | Description |
|----------|-------------|-------------|
| `ANTHROPIC_API_KEY` | Live mode, Demo mode | Your Anthropic API key — get one at [console.anthropic.com](https://console.anthropic.com/keys) |
| `META_ACCESS_TOKEN` | Live mode only | Facebook User Access Token with `ads_read` permission |

Copy `.env.example` to `.env` and fill in your keys. The tool uses `dotenv` so it loads automatically.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.x (strict mode) |
| Runtime | Node.js 18+ (native `fetch`, `parseArgs`) |
| AI pipeline | `@anthropic-ai/sdk` — Haiku (extract) + Sonnet (synthesize) |
| Ad data | Meta Ad Library REST API (`graph.facebook.com/v19.0/ads_archive`) |
| Build | `tsc` (ESM output, NodeNext module resolution) |
| Tests | Vitest |
| Config | `dotenv` |

---

## Project structure

```
ad-scout/
├── src/
│   ├── cli.ts          # Entry point, arg parsing, mode routing
│   ├── meta.ts         # Meta Ad Library API client
│   ├── analyze.ts      # Two-stage Claude pipeline (Haiku → Sonnet)
│   ├── report.ts       # Pure Markdown renderer
│   └── types.ts        # Ad, AdInsight, Analysis types
├── data/
│   └── sample-ads.json # 8 realistic DTC skincare sample ads (--demo)
├── examples/
│   └── sample-report.md # Pre-built example report (--offline)
├── tests/
│   ├── report.test.ts  # Report rendering tests (pure function)
│   └── analyze.test.ts # JSON fence-stripping + copy extraction tests
├── .env.example
├── .gitignore
├── LICENSE
├── package.json
├── README.md
└── tsconfig.json
```

---

## Development

```bash
# Clone and install
git clone https://github.com/liamssbusiness/ad-scout
cd ad-scout
npm install

# Build
npm run build

# Run without building (tsx)
npm run dev -- glossier --offline

# Tests
npm test

# Quick offline demo
npm run demo:offline
```

---

## Roadmap

- **CSV/JSON output mode** (`--format json`) for piping into dashboards
- **Multi-brand comparison** — run against 2–3 competitors and get a side-by-side breakdown
- **Spend-weighted analysis** — weight insights by estimated impression/spend data from the API
- **Saved profiles** — cache brand results locally so you can re-run synthesis without re-fetching
- **GitHub Actions workflow** — weekly competitor report delivered to your inbox or Slack

---

## License

MIT — see [LICENSE](LICENSE).

---

Built by [Liam Schnorr](https://github.com/liamssbusiness)
