import { describe, expect, it } from "vitest";
import { UnknownTimeZoneError } from "../src/resolve.js";
import { resolveTimeZone } from "../src/index.js";

describe("resolveTimeZone", () => {
  it("returns the named zone and offset when current (pre-divergence)", () => {
    const result = resolveTimeZone({
      instant: "2026-06-01T12:00:00Z",
      timeZoneId: "America/Edmonton",
    });
    expect(result.support.status).toBe("current");
    expect(result.timeZoneId).toBe("America/Edmonton");
    expect(result.offset).toBe("-06:00");
    expect(result.label).toBe("Alberta Time (ABT)");
  });

  it("returns a fixed Etc/GMT zone and the legislated offset when stale", () => {
    const result = resolveTimeZone({
      instant: "2026-11-02T12:00:00Z",
      timeZoneId: "America/Edmonton",
    });
    expect(result.support.status).toBe("stale");
    expect(result.timeZoneId).toBe("Etc/GMT+6");
    expect(result.offset).toBe("-06:00");
    expect(result.label).toBe("Alberta Time (ABT)");
  });

  it.each([
    ["America/Edmonton", "Etc/GMT+6", "-06:00"],
    ["America/Vancouver", "Etc/GMT+7", "-07:00"],
    ["America/Winnipeg", "Etc/GMT+5", "-05:00"],
  ])("corrects %s to %s at %s once stale", (timeZoneId, fixedZone, offset) => {
    const result = resolveTimeZone({ instant: "2026-11-15T12:00:00Z", timeZoneId });
    expect(result.timeZoneId).toBe(fixedZone);
    expect(result.offset).toBe(offset);
  });

  it("normalizes recognized aliases before resolving", () => {
    const result = resolveTimeZone({
      instant: "2026-11-02T12:00:00Z",
      timeZoneId: "Canada/Mountain",
    });
    expect(result.support.timeZoneId).toBe("America/Edmonton");
    expect(result.timeZoneId).toBe("Etc/GMT+6");
  });

  it("resolves ungoverned zones without correction", () => {
    const result = resolveTimeZone({
      instant: "2026-11-02T12:00:00Z",
      timeZoneId: "America/Toronto",
    });
    expect(result.support.status).toBe("not_applicable");
    expect(result.timeZoneId).toBe("America/Toronto");
    expect(result.label).toBe("America/Toronto");
  });

  it("falls back to en-CA when an unsupported locale is requested", () => {
    const result = resolveTimeZone({
      instant: "2026-11-02T12:00:00Z",
      timeZoneId: "America/Edmonton",
      locale: "de-DE",
    });
    expect(result.label).toBe("Alberta Time (ABT)");
  });

  it("throws for an unknown time zone identifier", () => {
    expect(() =>
      resolveTimeZone({ instant: "2026-11-02T12:00:00Z", timeZoneId: "Not/AZone" }),
    ).toThrow(UnknownTimeZoneError);
  });

  it("throws for a malformed instant", () => {
    expect(() =>
      resolveTimeZone({ instant: "not-an-instant", timeZoneId: "America/Edmonton" }),
    ).toThrow(RangeError);
  });

  it("throws for an invalid explicit-offset instant", () => {
    expect(() =>
      resolveTimeZone({ instant: "2026-11-02T12:00:00+99:00", timeZoneId: "America/Edmonton" }),
    ).toThrow(RangeError);
  });
});
