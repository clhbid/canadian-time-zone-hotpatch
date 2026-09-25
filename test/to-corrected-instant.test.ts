import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OffsetBearingWallTimeError,
  UnknownTimeZoneError
} from "../src/index.js";
import type { Disambiguation } from "../src/types.js";
import type {
  HostModule,
  SimulatedHostState
} from "./fixtures/simulated-host.js";
import { hotpatch } from "./fixtures/temporal.js";

const { toCorrectedInstant, toTimeZoneLabel } = hotpatch;

const hostState = vi.hoisted<SimulatedHostState>(() => ({ tzdata: "stale" }));

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

describe("toCorrectedInstant", () => {
  describe("on the divergence day", () => {
    it.each(disambiguations)(
      "produces the legislated instant on a stale host under %s",
      (disambiguation) => {
        // A stale host repeats 01:00–02:00 that morning; the rule does not.
        const result = toCorrectedInstant({
          wallTime: "2026-11-01T01:30:00",
          timeZoneId: "America/Edmonton",
          disambiguation
        });
        expect(result.instant).toBe("2026-11-01T07:30:00Z");
        expect(result.offset).toBe("-06:00");
        expect(result.timeZoneId).toBe("Etc/GMT+6");
        expect(result.support.status).toBe("stale");
        // 01:30 that morning is still before the rule's first divergence, so
        // the offset is corrected but the approved label does not apply yet.
        expect(
          toTimeZoneLabel({
            instant: result.instant,
            timeZoneId: "America/Edmonton"
          })
        ).toBeUndefined();
      }
    );

    it.each(disambiguations)(
      "keeps the canonical zone on an updated host under %s",
      (disambiguation) => {
        hostState.tzdata = "current";
        const result = toCorrectedInstant({
          wallTime: "2026-11-01T01:30:00",
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
        const result = toCorrectedInstant({
          wallTime: "2026-03-08T02:30:00",
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
        const result = toCorrectedInstant({
          wallTime: "2025-11-02T01:30:00",
          timeZoneId: "America/Edmonton",
          disambiguation
        });
        expect(result.instant).toBe(instant);
        expect(result.offset).toBe(offset);
      }
    );

    it.each(["2026-03-08T02:30:00", "2025-11-02T01:30:00"])(
      "rejects %s under reject with a RangeError that is not an unknown zone",
      (wallTime) => {
        const attempt = () =>
          toCorrectedInstant({
            wallTime,
            timeZoneId: "America/Edmonton",
            disambiguation: "reject"
          });
        expect(attempt).toThrow(RangeError);
        expect(attempt).not.toThrow(UnknownTimeZoneError);
      }
    );
  });

  it.each([
    ["America/Edmonton", "Etc/GMT+6", "2026-12-25T16:00:00Z"],
    ["America/Vancouver", "Etc/GMT+7", "2026-12-25T17:00:00Z"],
    ["America/Winnipeg", "Etc/GMT+5", "2026-12-25T15:00:00Z"],
    ["America/Yellowknife", "Etc/GMT+6", "2026-12-25T16:00:00Z"],
    ["America/Inuvik", "Etc/GMT+6", "2026-12-25T16:00:00Z"]
  ])(
    "corrects %s wall times after divergence via %s",
    (timeZoneId, fixed, instant) => {
      const result = toCorrectedInstant({
        wallTime: "2026-12-25T10:00:00",
        timeZoneId,
        disambiguation: "compatible"
      });
      expect(result.timeZoneId).toBe(fixed);
      expect(result.instant).toBe(instant);
    }
  );

  it.each([
    ["America/Yellowknife", "nt-yellowknife-permanent-time-2026"],
    ["America/Inuvik", "nt-inuvik-permanent-time-2026"]
  ])(
    "resolves a %s wall time under its own rule on a stale host",
    (timeZoneId, ruleId) => {
      expect(
        toCorrectedInstant({
          wallTime: "2026-12-15T10:00:00",
          timeZoneId,
          disambiguation: "reject"
        })
      ).toEqual({
        instant: "2026-12-15T16:00:00Z",
        timeZoneId: "Etc/GMT+6",
        offset: "-06:00",
        support: { status: "stale", timeZoneId, ruleId }
      });
    }
  );

  describe("a host that adopted the rule and later revised it", () => {
    const revisedAt = "2027-11-07T02:00:00-07:00";

    beforeEach(() => {
      hostState.tzdata = { "America/Edmonton": { revisedAt } };
    });

    it("defers to the host's own permanent offset before the revision", () => {
      expect(
        toCorrectedInstant({
          wallTime: "2027-06-01T10:00:00",
          timeZoneId: "America/Edmonton",
          disambiguation: "reject"
        })
      ).toEqual({
        instant: "2027-06-01T16:00:00Z",
        timeZoneId: "America/Edmonton",
        offset: "-06:00",
        support: {
          status: "rule_outdated",
          timeZoneId: "America/Edmonton",
          ruleId: "ab-permanent-time-2026"
        }
      });
    });

    it("defers to the host's seasonal offset after the revision", () => {
      expect(
        toCorrectedInstant({
          wallTime: "2027-12-25T10:00:00",
          timeZoneId: "America/Edmonton",
          disambiguation: "reject"
        })
      ).toEqual({
        instant: "2027-12-25T17:00:00Z",
        timeZoneId: "America/Edmonton",
        offset: "-07:00",
        support: {
          status: "rule_outdated",
          timeZoneId: "America/Edmonton",
          ruleId: "ab-permanent-time-2026"
        }
      });
    });
  });

  it("normalizes aliases", () => {
    const result = toCorrectedInstant({
      wallTime: "2026-06-01T10:00:00",
      timeZoneId: "Canada/Mountain",
      disambiguation: "compatible"
    });
    expect(result.timeZoneId).toBe("America/Edmonton");
    expect(result.support.timeZoneId).toBe("America/Edmonton");
  });

  it("applies the host's own disambiguation to an ungoverned zone", () => {
    const correct = (disambiguation: Disambiguation) =>
      toCorrectedInstant({
        wallTime: "2025-11-02T01:30:00",
        timeZoneId: "America/Toronto",
        disambiguation
      });
    expect(correct("earlier").instant).toBe("2025-11-02T05:30:00Z");
    expect(correct("later").instant).toBe("2025-11-02T06:30:00Z");
    expect(() => correct("reject")).toThrow(RangeError);
    expect(() => correct("reject")).not.toThrow(UnknownTimeZoneError);
  });

  it("passes an ungoverned zone through to the host", () => {
    const result = toCorrectedInstant({
      wallTime: "2026-12-25T10:00:00",
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

  it("throws for an unknown zone rather than choosing a jurisdiction", () => {
    expect(() =>
      toCorrectedInstant({
        wallTime: "2026-12-25T10:00:00",
        timeZoneId: "Not/AZone",
        disambiguation: "compatible"
      })
    ).toThrow(UnknownTimeZoneError);
  });

  it.each([
    "2026-11-01T01:30:00Z",
    "2026-11-01T01:30:00-07:00",
    "2026-11-01T01:30:00+00:00[America/Edmonton]",
    "2026-11-01 01:30-0700",
    "2026-11-01T01:30:00+99:00"
  ])("rejects the offset-bearing wall time %s", (wallTime) => {
    expect(() =>
      toCorrectedInstant({
        wallTime,
        timeZoneId: "America/Edmonton",
        disambiguation: "compatible"
      })
    ).toThrow(OffsetBearingWallTimeError);
  });

  it("throws RangeError for a malformed wall time", () => {
    expect(() =>
      toCorrectedInstant({
        wallTime: "not-a-date-time",
        timeZoneId: "America/Edmonton",
        disambiguation: "compatible"
      })
    ).toThrow(RangeError);
  });
});
