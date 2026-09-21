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
    ["America/Winnipeg", "-05:00", "Etc/GMT+5"],
  ])(
    "governs %s with permanent offset %s via %s",
    (canonicalTimeZoneId, offset, fixedTimeZoneId) => {
      const rule = findRule(canonicalTimeZoneId);
      expect(rule?.offset).toBe(offset);
      expect(rule?.fixedTimeZoneId).toBe(fixedTimeZoneId);
    },
  );

  it("normalizes aliases to their canonical id, and leaves unknown ids untouched", () => {
    expect(normalizeTimeZoneId("Canada/Mountain")).toBe("America/Edmonton");
    expect(normalizeTimeZoneId("America/Toronto")).toBe("America/Toronto");
  });
});
