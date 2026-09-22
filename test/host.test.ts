import { Temporal } from "temporal-polyfill";
import { describe, expect, it } from "vitest";
import { observeInstant, observeOffset } from "../src/host.js";

describe("host helpers", () => {
  it("observes the host offset for a recognized time zone", () => {
    const instant = Temporal.Instant.from("2026-11-01T08:00:00Z");
    expect(observeOffset("Etc/GMT+5", instant)).toBe("-05:00");
  });

  it("returns undefined when offset observation receives an invalid time zone", () => {
    const instant = Temporal.Instant.from("2026-11-01T08:00:00Z");
    expect(observeOffset("Not/AZone", instant)).toBeUndefined();
  });

  // Toronto's seasonal rules are stable in every tzdata, so the real host
  // can exercise Temporal's own disambiguation here.
  it("resolves a repeated wall-clock time under each disambiguation", () => {
    const local = Temporal.PlainDateTime.from("2025-11-02T01:30:00");
    const at = (disambiguation: "compatible" | "earlier" | "later") =>
      observeInstant("America/Toronto", local, disambiguation).toString();
    expect(at("earlier")).toBe("2025-11-02T05:30:00Z");
    expect(at("later")).toBe("2025-11-02T06:30:00Z");
    expect(at("compatible")).toBe(at("earlier"));
  });

  it("throws under reject for a repeated wall-clock time", () => {
    const local = Temporal.PlainDateTime.from("2025-11-02T01:30:00");
    expect(() => observeInstant("America/Toronto", local, "reject")).toThrow(
      RangeError
    );
  });

  it("throws when wall-clock resolution receives an invalid time zone", () => {
    const local = Temporal.PlainDateTime.from("2025-11-02T12:00:00");
    expect(() => observeInstant("Not/AZone", local, "compatible")).toThrow(
      RangeError
    );
  });
});
