import { describe, expect, it } from "vitest";
import { UnknownTimeZoneError } from "../src/resolve.js";
import { resolveLocalDateTime } from "../src/index.js";

describe("resolveLocalDateTime", () => {
  it("produces the legislated instant on a stale host, regardless of disambiguation", () => {
    const disambiguations = ["compatible", "earlier", "later", "reject"] as const;
    for (const disambiguation of disambiguations) {
      const result = resolveLocalDateTime({
        localDateTime: "2026-11-01T01:30:00",
        timeZoneId: "America/Edmonton",
        disambiguation,
      });
      expect(result.offset).toBe("-06:00");
      expect(result.instant).toBe("2026-11-01T07:30:00Z");
      expect(result.timeZoneId).toBe("Etc/GMT+6");
    }
  });

  it("resolves normal (pre-divergence) nonexistent local times using host disambiguation", () => {
    const skipped = resolveLocalDateTime({
      localDateTime: "2026-03-08T02:30:00",
      timeZoneId: "America/Edmonton",
      disambiguation: "compatible",
    });
    expect(skipped.offset).toBe("-06:00");
    expect(skipped.timeZoneId).toBe("America/Edmonton");

    expect(() =>
      resolveLocalDateTime({
        localDateTime: "2026-03-08T02:30:00",
        timeZoneId: "America/Edmonton",
        disambiguation: "reject",
      }),
    ).toThrow(RangeError);
  });

  it("resolves normal (pre-divergence) ambiguous local times using host disambiguation", () => {
    // A normal (non-legislated) fall-back the year before any rule applies.
    const earlier = resolveLocalDateTime({
      localDateTime: "2025-11-02T01:30:00",
      timeZoneId: "America/Edmonton",
      disambiguation: "earlier",
    });
    const later = resolveLocalDateTime({
      localDateTime: "2025-11-02T01:30:00",
      timeZoneId: "America/Edmonton",
      disambiguation: "later",
    });
    expect(earlier.offset).toBe("-06:00");
    expect(later.offset).toBe("-07:00");
    expect(earlier.instant).not.toBe(later.instant);
  });

  it.each([
    ["America/Edmonton", "Etc/GMT+6", "-06:00"],
    ["America/Vancouver", "Etc/GMT+7", "-07:00"],
    ["America/Winnipeg", "Etc/GMT+5", "-05:00"],
  ])("corrects %s local dates on/after divergence day to %s", (timeZoneId, fixedZone, offset) => {
    const result = resolveLocalDateTime({
      localDateTime: "2026-12-25T09:00:00",
      timeZoneId,
      disambiguation: "compatible",
    });
    expect(result.timeZoneId).toBe(fixedZone);
    expect(result.offset).toBe(offset);
  });

  it("normalizes recognized aliases", () => {
    const result = resolveLocalDateTime({
      localDateTime: "2026-12-25T09:00:00",
      timeZoneId: "Canada/Mountain",
      disambiguation: "compatible",
    });
    expect(result.support.timeZoneId).toBe("America/Edmonton");
    expect(result.timeZoneId).toBe("Etc/GMT+6");
  });

  it("resolves ungoverned zones without correction", () => {
    const result = resolveLocalDateTime({
      localDateTime: "2026-12-25T09:00:00",
      timeZoneId: "America/Toronto",
      disambiguation: "compatible",
    });
    expect(result.support.status).toBe("not_applicable");
    expect(result.timeZoneId).toBe("America/Toronto");
  });

  it("throws for an unknown time zone identifier", () => {
    expect(() =>
      resolveLocalDateTime({
        localDateTime: "2026-12-25T09:00:00",
        timeZoneId: "Not/AZone",
        disambiguation: "compatible",
      }),
    ).toThrow(UnknownTimeZoneError);
  });

  it("throws for a malformed local date-time", () => {
    expect(() =>
      resolveLocalDateTime({
        localDateTime: "not-a-date-time",
        timeZoneId: "America/Edmonton",
        disambiguation: "compatible",
      }),
    ).toThrow(RangeError);
  });
});
