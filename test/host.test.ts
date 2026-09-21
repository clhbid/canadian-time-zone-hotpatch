import { Temporal } from "temporal-polyfill";
import { describe, expect, it } from "vitest";
import { observeOffset } from "../src/host.js";

describe("host helpers", () => {
  it("observes the host offset for a recognized time zone", () => {
    const instant = Temporal.Instant.from("2026-11-01T08:00:00Z");
    expect(observeOffset("Etc/GMT+5", instant)).toBe("-05:00");
  });

  it("returns undefined when offset observation receives an invalid time zone", () => {
    const instant = Temporal.Instant.from("2026-11-01T08:00:00Z");
    expect(observeOffset("Not/AZone", instant)).toBeUndefined();
  });
});
