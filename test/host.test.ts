import { describe, expect, it } from "vitest";
import { observeOffset, isKnownTimeZoneId } from "../src/host.js";
import { Temporal } from "temporal-polyfill";

describe("host helpers", () => {
  it("observes the host offset for a recognized time zone", () => {
    const instant = Temporal.Instant.from("2026-11-01T08:00:00Z");
    expect(observeOffset("Etc/GMT+5", instant)).toBe("-05:00");
  });

  it("returns undefined when offset observation receives an invalid time zone", () => {
    const instant = Temporal.Instant.from("2026-11-01T08:00:00Z");
    expect(observeOffset("Not/AZone", instant)).toBeUndefined();
  });

  it("distinguishes recognized and invalid time zone ids", () => {
    expect(isKnownTimeZoneId("UTC")).toBe(true);
    expect(isKnownTimeZoneId("Not/AZone")).toBe(false);
  });
});
