/**
 * Tests for pure/utility functions in analyze.ts.
 * We test the JSON fence-stripping logic in isolation (no API calls).
 */

import { describe, it, expect } from "vitest";

// ── Inline the fence-stripping logic so we can test it without importing
//    the full analyze module (which lazily inits the Anthropic client).
//    This is the exact same function from analyze.ts.
function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

describe("stripCodeFences", () => {
  it("returns clean JSON unchanged", () => {
    const input = '{"hook": "Hello world"}';
    expect(stripCodeFences(input)).toBe('{"hook": "Hello world"}');
  });

  it("strips ```json ... ``` fences", () => {
    const input = '```json\n{"hook": "Hello world"}\n```';
    expect(stripCodeFences(input)).toBe('{"hook": "Hello world"}');
  });

  it("strips plain ``` fences", () => {
    const input = "```\n{\"hook\": \"Hello world\"}\n```";
    expect(stripCodeFences(input)).toBe('{"hook": "Hello world"}');
  });

  it("handles uppercase JSON fence (```JSON)", () => {
    const input = "```JSON\n{\"key\": \"val\"}\n```";
    expect(stripCodeFences(input)).toBe('{"key": "val"}');
  });

  it("handles trailing whitespace around fences", () => {
    const input = "```json   \n{\"key\": \"val\"}\n```  ";
    expect(stripCodeFences(input)).toBe('{"key": "val"}');
  });

  it("produces parseable JSON after stripping", () => {
    const input = '```json\n{"hook":"test","angle":"social proof","offer":"20% off","format":"image"}\n```';
    const stripped = stripCodeFences(input);
    const parsed = JSON.parse(stripped);
    expect(parsed.hook).toBe("test");
    expect(parsed.angle).toBe("social proof");
    expect(parsed.offer).toBe("20% off");
    expect(parsed.format).toBe("image");
  });
});

// ── Test the ad copy extraction logic (also inlined for isolation)
function extractAdCopy(ad: {
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_captions?: string[];
}): string {
  const parts: string[] = [];
  if (ad.ad_creative_bodies?.length) parts.push(...ad.ad_creative_bodies);
  if (ad.ad_creative_link_titles?.length) parts.push(...ad.ad_creative_link_titles);
  if (ad.ad_creative_link_captions?.length) parts.push(...ad.ad_creative_link_captions);

  const combined = parts.join(" | ").trim();
  if (!combined) return "[No ad copy available — creative may be image/video only]";
  return combined.length > 800 ? combined.slice(0, 800) + "…" : combined;
}

describe("extractAdCopy", () => {
  it("returns body text when available", () => {
    const ad = { ad_creative_bodies: ["Buy now and save 20%!"] };
    expect(extractAdCopy(ad)).toBe("Buy now and save 20%!");
  });

  it("falls back to link title when no body", () => {
    const ad = { ad_creative_link_titles: ["Shop the sale"] };
    expect(extractAdCopy(ad)).toBe("Shop the sale");
  });

  it("joins multiple sources with ' | '", () => {
    const ad = {
      ad_creative_bodies: ["Body text here"],
      ad_creative_link_titles: ["Link title"],
    };
    expect(extractAdCopy(ad)).toBe("Body text here | Link title");
  });

  it("returns fallback for empty ad", () => {
    const ad = {};
    expect(extractAdCopy(ad)).toBe(
      "[No ad copy available — creative may be image/video only]"
    );
  });

  it("truncates copy longer than 800 chars", () => {
    const longBody = "A".repeat(900);
    const ad = { ad_creative_bodies: [longBody] };
    const result = extractAdCopy(ad);
    expect(result.length).toBeLessThanOrEqual(802); // 800 + "…"
    expect(result.endsWith("…")).toBe(true);
  });

  it("does not truncate copy exactly 800 chars", () => {
    const exactBody = "A".repeat(800);
    const ad = { ad_creative_bodies: [exactBody] };
    const result = extractAdCopy(ad);
    expect(result).toBe(exactBody);
    expect(result.endsWith("…")).toBe(false);
  });
});
