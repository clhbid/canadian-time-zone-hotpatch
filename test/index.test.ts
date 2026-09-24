import { describe, expect, it } from "vitest";
import * as pkg from "../src/index.js";

describe("package root", () => {
  it("exports exactly the trimmed runtime surface", () => {
    expect(Object.keys(pkg).sort()).toEqual([
      "Disambiguation",
      "MissingTemporalError",
      "OffsetBearingWallTimeError",
      "TimeZoneSupportStatus",
      "UnknownTimeZoneError",
      "createHotpatch",
      "inspectHostSupport",
      "rules",
      "toCorrectedInstant",
      "toCorrectedZonedTime",
      "toTimeZoneLabel"
    ]);
  });

  // Values are already pinned where they are used: every status literal in
  // `inspect.test.ts`, every disambiguation literal in the correction specs.
  it.each([
    [
      "Disambiguation",
      pkg.Disambiguation,
      ["compatible", "earlier", "later", "reject"]
    ],
    [
      "TimeZoneSupportStatus",
      pkg.TimeZoneSupportStatus,
      ["current", "not_applicable", "stale", "unknown"]
    ]
  ])("%s is frozen and exposes exactly its members", (_, constant, members) => {
    expect(Object.keys(constant).sort()).toEqual(members);
    expect(Object.isFrozen(constant)).toBe(true);
  });

  it("exports the rule table the package corrects with", () => {
    expect(pkg.rules).toMatchObject([
      {
        ruleId: "ab-permanent-time-2026",
        canonicalTimeZoneId: "America/Edmonton",
        offset: "-06:00",
        firstDivergenceInstant: "2026-11-01T02:00:00-06:00"
      },
      {
        ruleId: "bc-permanent-time-2026",
        canonicalTimeZoneId: "America/Vancouver",
        offset: "-07:00",
        firstDivergenceInstant: "2026-11-01T02:00:00-07:00"
      },
      {
        ruleId: "mb-permanent-time-2026",
        canonicalTimeZoneId: "America/Winnipeg",
        offset: "-05:00",
        firstDivergenceInstant: "2026-11-01T02:00:00-05:00"
      }
    ]);
  });

  it("is frozen at every level and rejects writes", () => {
    expect(Object.isFrozen(pkg.rules)).toBe(true);
    for (const rule of pkg.rules) {
      expect(Object.isFrozen(rule)).toBe(true);
      expect(Object.isFrozen(rule.aliases)).toBe(true);
    }

    expect(() => {
      "use strict";
      // @ts-expect-error -- verifying that a write to a frozen rule throws.
      pkg.rules[0].offset = "+00:00";
    }).toThrow(TypeError);
  });
});
