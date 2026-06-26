/**
 * Tests for report.ts (pure function — no API calls).
 * Run with: npm test
 */

import { describe, it, expect } from "vitest";
import { renderReport } from "../src/report.js";
import type { Analysis } from "../src/types.js";

const mockAnalysis: Analysis = {
  brand: "TestBrand",
  ads_analyzed: 3,
  ad_insights: [
    {
      ad_id: "001",
      page_name: "TestBrand Official",
      ad_copy: "Try our product today!",
      hook: "Try our product today!",
      angle: "Direct offer",
      offer: "20% off",
      format: "image",
    },
    {
      ad_id: "002",
      page_name: "TestBrand Official",
      ad_copy: "Customers love us.",
      hook: "Customers love us.",
      angle: "Social proof",
      offer: "Free trial",
      format: "video",
    },
    {
      ad_id: "003",
      page_name: "TestBrand Ads",
      ad_copy: "Limited time offer ends tonight.",
      hook: "Limited time offer ends tonight.",
      angle: "Urgency / scarcity",
      offer: "30% off, tonight only",
      format: "carousel",
    },
  ],
  common_hooks: ["Limited time framing", "Social proof opens"],
  dominant_angles: ["Social proof", "Urgency"],
  offer_patterns: ["Percentage discounts", "Free trials"],
  format_mix: ["Image (50%)", "Video (33%)", "Carousel (17%)"],
  gaps: ["No educational content", "No subscription angle"],
  recommendations: [
    "Lead with a specific number",
    "Add money-back guarantee to every creative",
  ],
  summary:
    "TestBrand focuses on social proof and urgency with discount-first offers.",
};

describe("renderReport", () => {
  it("includes the brand name in the report title", () => {
    const report = renderReport(mockAnalysis);
    expect(report).toContain("# ad-scout Report: TestBrand");
  });

  it("includes the correct ads analyzed count", () => {
    const report = renderReport(mockAnalysis);
    expect(report).toContain("Ads analyzed: **3**");
  });

  it("includes all major sections", () => {
    const report = renderReport(mockAnalysis);
    expect(report).toContain("## Executive Summary");
    expect(report).toContain("## Strategic Breakdown");
    expect(report).toContain("## Gaps & Opportunities");
    expect(report).toContain("## Recommendations");
    expect(report).toContain("## Per-Ad Breakdown");
  });

  it("includes the executive summary text", () => {
    const report = renderReport(mockAnalysis);
    expect(report).toContain(
      "TestBrand focuses on social proof and urgency"
    );
  });

  it("renders common hooks as bullet points", () => {
    const report = renderReport(mockAnalysis);
    expect(report).toContain("- Limited time framing");
    expect(report).toContain("- Social proof opens");
  });

  it("renders recommendations as numbered bold items", () => {
    const report = renderReport(mockAnalysis);
    expect(report).toContain("**1.** Lead with a specific number");
    expect(report).toContain("**2.** Add money-back guarantee");
  });

  it("renders the per-ad table with correct row count", () => {
    const report = renderReport(mockAnalysis);
    // Should have 3 data rows + 2 header rows = 5 lines containing "| "
    const tableLines = report
      .split("\n")
      .filter((line) => line.startsWith("|"));
    expect(tableLines.length).toBe(5); // header, separator, 3 rows
  });

  it("truncates long hooks in the table to keep it readable", () => {
    const longHookAnalysis: Analysis = {
      ...mockAnalysis,
      ad_insights: [
        {
          ...mockAnalysis.ad_insights[0],
          hook: "A".repeat(80), // 80 chars — should be truncated to 60 + "..."
        },
      ],
      ads_analyzed: 1,
    };
    const report = renderReport(longHookAnalysis);
    // The truncated hook in the table should end with "..."
    expect(report).toContain("...");
    // The full 80-char hook should NOT appear verbatim in the table
    expect(report).not.toContain("A".repeat(80));
  });
});
