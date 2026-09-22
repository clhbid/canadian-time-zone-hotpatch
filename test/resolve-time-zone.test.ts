import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  inspectTimeZoneSupport,
  resolveTimeZone,
  UnknownTimeZoneError
} from "../src/index.js";
import { rules } from "../src/rules.js";
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

describe("resolveTimeZone", () => {
  it("keeps the canonical zone before first divergence", () => {
    const result = resolveTimeZone({
      instant: "2026-06-01T12:00:00Z",
      timeZoneId: "America/Edmonton"
    });
    expect(result).toEqual({
      instant: "2026-06-01T12:00:00Z",
      timeZoneId: "America/Edmonton",
      offset: "-06:00",
      label: { long: "Alberta Time", short: "ABT" },
      support: expect.objectContaining({ status: "current" })
    });
  });

  it.each([
    [
      "America/Edmonton",
      "Etc/GMT+6",
      "-06:00",
      { long: "Alberta Time", short: "ABT" }
    ],
    [
      "America/Vancouver",
      "Etc/GMT+7",
      "-07:00",
      { long: "Pacific Time", short: "PCT" }
    ],
    [
      "America/Winnipeg",
      "Etc/GMT+5",
      "-05:00",
      { long: "Manitoba Time", short: "MBT" }
    ]
  ])("corrects %s to %s once stale", (timeZoneId, fixed, offset, label) => {
    const result = resolveTimeZone({
      instant: "2026-12-25T12:00:00Z",
      timeZoneId
    });
    expect(result.timeZoneId).toBe(fixed);
    expect(result.offset).toBe(offset);
    expect(result.label).toEqual(label);
  });

  it("normalizes aliases before resolving", () => {
    const result = resolveTimeZone({
      instant: "2026-11-02T12:00:00Z",
      timeZoneId: "canada/mountain"
    });
    expect(result.support.timeZoneId).toBe("America/Edmonton");
    expect(result.timeZoneId).toBe("Etc/GMT+6");
  });

  it("passes an ungoverned zone through to the host without a label", () => {
    const result = resolveTimeZone({
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

  it("falls back to en-CA for an unsupported locale", () => {
    const result = resolveTimeZone({
      instant: "2026-11-02T12:00:00Z",
      timeZoneId: "America/Edmonton",
      locale: "de-DE"
    });
    expect(result.label).toEqual({ long: "Alberta Time", short: "ABT" });
  });

  it("returns a frozen result", () => {
    const result = resolveTimeZone({
      instant: "2026-11-02T12:00:00Z",
      timeZoneId: "America/Edmonton"
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("throws for an unknown zone rather than choosing a jurisdiction", () => {
    expect(() =>
      resolveTimeZone({
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
      resolveTimeZone({ instant, timeZoneId: "America/Edmonton" })
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
            const result = resolveTimeZone({ instant, timeZoneId });
            const support = inspectTimeZoneSupport({ timeZoneId, instant });
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
