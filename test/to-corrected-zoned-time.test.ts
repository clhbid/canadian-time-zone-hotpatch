import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnknownTimeZoneError } from "../src/index.js";
import { inspectTimeZoneSupport } from "../src/inspect.js";
import { rules } from "../src/rules.js";
import type { HostModule, SimulatedTzdata } from "./fixtures/simulated-host.js";
import { hotpatch, temporal } from "./fixtures/temporal.js";

const { toCorrectedZonedTime } = hotpatch;

const hostState = vi.hoisted(() => ({ tzdata: "stale" as SimulatedTzdata }));

vi.mock("../src/host.js", async (importOriginal) => {
  const actual = await importOriginal<HostModule>();
  const { simulatedHostModule } = await import("./fixtures/simulated-host.js");
  return simulatedHostModule(actual, hostState);
});

beforeEach(() => {
  hostState.tzdata = "stale";
});

describe("toCorrectedZonedTime", () => {
  it("keeps the canonical zone before first divergence", () => {
    const result = toCorrectedZonedTime({
      instant: "2026-06-01T12:00:00Z",
      timeZoneId: "America/Edmonton"
    });
    expect(result).toEqual({
      instant: "2026-06-01T12:00:00Z",
      timeZoneId: "America/Edmonton",
      offset: "-06:00",
      support: expect.objectContaining({ status: "current" })
    });
  });

  it.each([
    ["America/Edmonton", "Etc/GMT+6", "-06:00"],
    ["America/Vancouver", "Etc/GMT+7", "-07:00"],
    ["America/Winnipeg", "Etc/GMT+5", "-05:00"],
    ["America/Yellowknife", "Etc/GMT+6", "-06:00"],
    ["America/Inuvik", "Etc/GMT+6", "-06:00"]
  ])("corrects %s to %s once stale", (timeZoneId, fixed, offset) => {
    const result = toCorrectedZonedTime({
      instant: "2026-12-25T12:00:00Z",
      timeZoneId
    });
    expect(result.timeZoneId).toBe(fixed);
    expect(result.offset).toBe(offset);
  });

  it.each([
    ["America/Yellowknife", "nt-yellowknife-permanent-time-2026"],
    ["America/Inuvik", "nt-inuvik-permanent-time-2026"]
  ])("corrects %s under its own rule on a stale host", (timeZoneId, ruleId) => {
    expect(
      toCorrectedZonedTime({
        instant: "2026-11-15T19:00:00Z",
        timeZoneId
      })
    ).toEqual({
      instant: "2026-11-15T19:00:00Z",
      timeZoneId: "Etc/GMT+6",
      offset: "-06:00",
      support: { status: "stale", timeZoneId, ruleId }
    });
  });

  it.each(["America/Yellowknife", "America/Inuvik"])(
    "passes %s through under its canonical identifier on a current host",
    (timeZoneId) => {
      hostState.tzdata = "current";
      const result = toCorrectedZonedTime({
        instant: "2026-11-15T19:00:00Z",
        timeZoneId
      });
      expect(result.timeZoneId).toBe(timeZoneId);
      expect(result.offset).toBe("-06:00");
      expect(result.support.status).toBe("current");
    }
  );

  it("normalizes aliases before correcting", () => {
    const result = toCorrectedZonedTime({
      instant: "2026-11-02T12:00:00Z",
      timeZoneId: "canada/mountain"
    });
    expect(result.support.timeZoneId).toBe("America/Edmonton");
    expect(result.timeZoneId).toBe("Etc/GMT+6");
  });

  it("passes an ungoverned zone through to the host", () => {
    const result = toCorrectedZonedTime({
      instant: "2026-11-02T12:00:00Z",
      timeZoneId: "America/Dawson_Creek"
    });
    expect(result).toEqual({
      instant: "2026-11-02T12:00:00Z",
      timeZoneId: "America/Dawson_Creek",
      offset: "-07:00",
      support: { status: "not_applicable", timeZoneId: "America/Dawson_Creek" }
    });
  });

  it("returns a frozen result", () => {
    const result = toCorrectedZonedTime({
      instant: "2026-11-02T12:00:00Z",
      timeZoneId: "America/Edmonton"
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("throws for an unknown zone rather than choosing a jurisdiction", () => {
    expect(() =>
      toCorrectedZonedTime({
        instant: "2026-11-02T12:00:00Z",
        timeZoneId: "Not/AZone"
      })
    ).toThrow(UnknownTimeZoneError);
  });

  it.each([
    "not-an-instant",
    "2026-11-02T12:00:00",
    "2026-11-02T12:00:00+99:00"
  ])("throws RangeError for the invalid instant %s", (instant) => {
    expect(() =>
      toCorrectedZonedTime({ instant, timeZoneId: "America/Edmonton" })
    ).toThrow(RangeError);
  });

  describe.each<SimulatedTzdata>(["stale", "current"])(
    "on a %s host",
    (tzdata) => {
      beforeEach(() => {
        hostState.tzdata = tzdata;
      });

      it.each(rules.map((rule) => [rule.canonicalTimeZoneId, rule] as const))(
        "agrees with inspection just before, at, and after %s's first divergence",
        (timeZoneId, rule) => {
          const divergence = Date.parse(rule.firstDivergenceInstant);
          for (const delta of [-1000, 0, 1000]) {
            const instant = new Date(divergence + delta).toISOString();
            const result = toCorrectedZonedTime({ instant, timeZoneId });
            const support = inspectTimeZoneSupport(
              temporal,
              timeZoneId,
              instant
            );
            expect(result.support).toEqual(support);
            expect(result.timeZoneId).toBe(
              support.status === "stale" ? rule.fixedTimeZoneId : timeZoneId
            );
            // The seasonal offset just before the skipped fall-back is the
            // permanent one, so every probe expects the rule's offset.
            expect(result.offset).toBe(rule.offset);
          }
        }
      );
    }
  );
});
