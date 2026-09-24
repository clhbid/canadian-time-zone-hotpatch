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
});
