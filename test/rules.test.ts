import { describe, expect, it } from "vitest";
import { findRule, normalizeTimeZoneId, rules } from "../src/rules.js";

describe("rules", () => {
  it("is frozen at every level", () => {
    expect(Object.isFrozen(rules)).toBe(true);
    for (const rule of rules) {
      expect(Object.isFrozen(rule)).toBe(true);
      expect(Object.isFrozen(rule.aliases)).toBe(true);
      expect(Object.isFrozen(rule.citations)).toBe(true);
    }
  });

  it("cites at least one source per rule", () => {
    for (const rule of rules) {
      expect(rule.citations.length).toBeGreaterThan(0);
      for (const citation of rule.citations) {
        expect(citation.title.length).toBeGreaterThan(0);
        expect(() => new URL(citation.url)).not.toThrow();
      }
    }
  });

  it("records a legal commencement instant no later than the first divergence", () => {
    for (const rule of rules) {
      if (!rule.legalEffectiveInstant) {
        continue;
      }
      const legal = Date.parse(rule.legalEffectiveInstant);
      const divergence = Date.parse(rule.firstDivergenceInstant);
      expect(Number.isNaN(legal)).toBe(false);
      expect(Number.isNaN(divergence)).toBe(false);
      expect(legal).toBeLessThanOrEqual(divergence);
    }
  });

  it.each([
    ["America/Edmonton", "-06:00", "Etc/GMT+6"],
    ["America/Vancouver", "-07:00", "Etc/GMT+7"],
    ["America/Winnipeg", "-05:00", "Etc/GMT+5"]
  ])(
    "governs %s with permanent offset %s via %s",
    (canonicalTimeZoneId, offset, fixedTimeZoneId) => {
      const rule = findRule(canonicalTimeZoneId);
      expect(rule?.offset).toBe(offset);
      expect(rule?.fixedTimeZoneId).toBe(fixedTimeZoneId);
    }
  );

  it.each([
    [
      "America/Edmonton",
      "2026-06-18T00:00:00-06:00",
      "2026-11-01T02:00:00-06:00"
    ],
    [
      "America/Vancouver",
      "2026-03-09T00:00:00-07:00",
      "2026-11-01T02:00:00-07:00"
    ],
    ["America/Winnipeg", undefined, "2026-11-01T02:00:00-05:00"]
  ])(
    "records the legal and first-divergent instants for %s",
    (timeZoneId, legalEffectiveInstant, firstDivergenceInstant) => {
      const rule = findRule(timeZoneId);
      expect(rule?.legalEffectiveInstant).toBe(legalEffectiveInstant);
      expect(rule?.firstDivergenceInstant).toBe(firstDivergenceInstant);
    }
  );

  it.each([
    ["america/edmonton", "canada/mountain", "America/Edmonton"],
    ["america/vancouver", "canada/pacific", "America/Vancouver"],
    ["america/winnipeg", "canada/central", "America/Winnipeg"]
  ])(
    "matches %s and its alias %s case-insensitively",
    (canonicalTimeZoneId, alias, expected) => {
      expect(normalizeTimeZoneId(canonicalTimeZoneId)).toBe(expected);
      expect(normalizeTimeZoneId(alias)).toBe(expected);
    }
  );

  it.each([
    "America/Creston",
    "America/Dawson_Creek",
    "America/Fort_Nelson",
    "America/Toronto"
  ])("does not govern unaffected zone %s", (timeZoneId) => {
    expect(findRule(timeZoneId)).toBeUndefined();
    expect(normalizeTimeZoneId(timeZoneId)).toBe(timeZoneId);
  });
});
