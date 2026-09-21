import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OffsetBearingLocalDateTimeError,
  resolveLocalDateTime,
  UnknownTimeZoneError
} from "../src/index.js";
import type { Disambiguation } from "../src/types.js";
import type { HostModule, SimulatedTzdata } from "./fixtures/simulated-host.js";

const hostState = vi.hoisted(() => ({ tzdata: "stale" as SimulatedTzdata }));

vi.mock("../src/host.js", async (importOriginal) => {
  const actual = await importOriginal<HostModule>();
  const { simulatedHostModule } = await import("./fixtures/simulated-host.js");
  return simulatedHostModule(actual, hostState);
});

beforeEach(() => {
  hostState.tzdata = "stale";
});

const disambiguations: readonly Disambiguation[] = [
  "compatible",
  "earlier",
  "later",
  "reject"
];

describe("resolveLocalDateTime", () => {
  describe("on the divergence day", () => {
    it.each(disambiguations)(
      "produces the legislated instant on a stale host under %s",
      (disambiguation) => {
        // A stale host repeats 01:00–02:00 that morning; the rule does not.
        const result = resolveLocalDateTime({
          localDateTime: "2026-11-01T01:30:00",
          timeZoneId: "America/Edmonton",
          disambiguation
        });
        expect(result.instant).toBe("2026-11-01T07:30:00Z");
        expect(result.offset).toBe("-06:00");
        expect(result.timeZoneId).toBe("Etc/GMT+6");
        expect(result.label).toBe("Alberta Time (ABT)");
        expect(result.support.status).toBe("stale");
      }
    );

    it("corrects a wall time after the skipped transition on a stale host", () => {
      const result = resolveLocalDateTime({
        localDateTime: "2026-11-01T09:00:00",
        timeZoneId: "America/Edmonton",
        disambiguation: "compatible"
      });
      expect(result.instant).toBe("2026-11-01T15:00:00Z");
      expect(result.offset).toBe("-06:00");
    });

    it.each(disambiguations)(
      "keeps the canonical zone on an updated host under %s",
      (disambiguation) => {
        hostState.tzdata = "current";
        const result = resolveLocalDateTime({
          localDateTime: "2026-11-01T01:30:00",
          timeZoneId: "America/Edmonton",
          disambiguation
        });
        expect(result.instant).toBe("2026-11-01T07:30:00Z");
        expect(result.timeZoneId).toBe("America/Edmonton");
        expect(result.support.status).toBe("current");
      }
    );
  });

  describe("before the divergence day", () => {
    it.each([
      ["compatible", "2026-03-08T09:30:00Z", "-06:00"],
      ["later", "2026-03-08T09:30:00Z", "-06:00"],
      ["earlier", "2026-03-08T08:30:00Z", "-07:00"]
    ] as const)(
      "resolves a nonexistent spring-forward time under %s",
      (disambiguation, instant, offset) => {
        const result = resolveLocalDateTime({
          localDateTime: "2026-03-08T02:30:00",
          timeZoneId: "America/Edmonton",
          disambiguation
        });
        expect(result.instant).toBe(instant);
        expect(result.offset).toBe(offset);
        expect(result.timeZoneId).toBe("America/Edmonton");
        expect(result.support.status).toBe("current");
      }
    );

    it.each([
      ["compatible", "2025-11-02T07:30:00Z", "-06:00"],
      ["earlier", "2025-11-02T07:30:00Z", "-06:00"],
      ["later", "2025-11-02T08:30:00Z", "-07:00"]
    ] as const)(
      "resolves an ambiguous fall-back time under %s",
      (disambiguation, instant, offset) => {
        const result = resolveLocalDateTime({
          localDateTime: "2025-11-02T01:30:00",
          timeZoneId: "America/Edmonton",
          disambiguation
        });
        expect(result.instant).toBe(instant);
        expect(result.offset).toBe(offset);
      }
    );

    it.each(["2026-03-08T02:30:00", "2025-11-02T01:30:00"])(
      "rejects %s under reject with a RangeError that is not an unknown zone",
      (localDateTime) => {
        expect(() =>
          resolveLocalDateTime({
            localDateTime,
            timeZoneId: "America/Edmonton",
            disambiguation: "reject"
          })
        ).toThrow(RangeError);
        expect(() =>
          resolveLocalDateTime({
            localDateTime,
            timeZoneId: "America/Edmonton",
            disambiguation: "reject"
          })
        ).not.toThrow(UnknownTimeZoneError);
      }
    );
  });

  it.each([
    ["America/Edmonton", "Etc/GMT+6", "2026-12-25T16:00:00Z"],
    ["America/Vancouver", "Etc/GMT+7", "2026-12-25T17:00:00Z"],
    ["America/Winnipeg", "Etc/GMT+5", "2026-12-25T15:00:00Z"]
  ])(
    "corrects %s wall times after divergence via %s",
    (timeZoneId, fixed, instant) => {
      const result = resolveLocalDateTime({
        localDateTime: "2026-12-25T10:00:00",
        timeZoneId,
        disambiguation: "compatible"
      });
      expect(result.timeZoneId).toBe(fixed);
      expect(result.instant).toBe(instant);
    }
  );

  it("normalizes aliases", () => {
    const result = resolveLocalDateTime({
      localDateTime: "2026-06-01T10:00:00",
      timeZoneId: "Canada/Mountain",
      disambiguation: "compatible"
    });
    expect(result.timeZoneId).toBe("America/Edmonton");
    expect(result.support.timeZoneId).toBe("America/Edmonton");
  });

  it("passes an ungoverned zone through to the host without a label", () => {
    const result = resolveLocalDateTime({
      localDateTime: "2026-12-25T10:00:00",
      timeZoneId: "America/Dawson_Creek",
      disambiguation: "compatible"
    });
    expect(result).toEqual({
      instant: "2026-12-25T17:00:00Z",
      timeZoneId: "America/Dawson_Creek",
      offset: "-07:00",
      support: { status: "not_applicable", timeZoneId: "America/Dawson_Creek" }
    });
  });

  it("accepts a date-only wall time as midnight", () => {
    const result = resolveLocalDateTime({
      localDateTime: "2026-12-25",
      timeZoneId: "America/Edmonton",
      disambiguation: "compatible"
    });
    expect(result.instant).toBe("2026-12-25T06:00:00Z");
  });

  it("throws for an unknown zone rather than choosing a jurisdiction", () => {
    expect(() =>
      resolveLocalDateTime({
        localDateTime: "2026-12-25T10:00:00",
        timeZoneId: "Not/AZone",
        disambiguation: "compatible"
      })
    ).toThrow(UnknownTimeZoneError);
  });

  it.each([
    "2026-11-01T01:30:00Z",
    "2026-11-01T01:30:00-07:00",
    "2026-11-01T01:30:00+00:00[America/Edmonton]",
    "2026-11-01 01:30-0700"
  ])("rejects the offset-bearing wall time %s", (localDateTime) => {
    expect(() =>
      resolveLocalDateTime({
        localDateTime,
        timeZoneId: "America/Edmonton",
        disambiguation: "compatible"
      })
    ).toThrow(OffsetBearingLocalDateTimeError);
  });

  it("throws RangeError for a malformed wall time", () => {
    expect(() =>
      resolveLocalDateTime({
        localDateTime: "not-a-date-time",
        timeZoneId: "America/Edmonton",
        disambiguation: "compatible"
      })
    ).toThrow(RangeError);
  });
});
