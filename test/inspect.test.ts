import { beforeEach, describe, expect, it, vi } from "vitest";
import { inspectTimeZoneSupport } from "../src/index.js";
import type { HostModule, SimulatedTzdata } from "./fixtures/simulated-host.js";

const hostState = vi.hoisted(() => ({ tzdata: "stale" as SimulatedTzdata }));

// The runner's own tzdata may or may not know the 2026 Canadian rules, so
// every governed-zone observation is served by a deterministic simulation.
vi.mock("../src/host.js", async (importOriginal) => {
  const actual = await importOriginal<HostModule>();
  const { simulatedHostModule } = await import("./fixtures/simulated-host.js");
  return simulatedHostModule(actual, hostState);
});

beforeEach(() => {
  hostState.tzdata = "stale";
});

describe("inspectTimeZoneSupport", () => {
  describe("zone identifiers", () => {
    it.each([
      ["America/Edmonton", "America/Edmonton"],
      ["america/edmonton", "America/Edmonton"],
      ["AMERICA/EDMONTON", "America/Edmonton"],
      ["Canada/Mountain", "America/Edmonton"],
      ["canada/mountain", "America/Edmonton"],
      ["Canada/Pacific", "America/Vancouver"],
      ["Canada/Central", "America/Winnipeg"]
    ])("normalizes %s to the canonical %s", (timeZoneId, canonical) => {
      expect(inspectTimeZoneSupport({ timeZoneId }).timeZoneId).toBe(canonical);
    });

    it.each([
      ["America/Edmonton", "ab-permanent-time-2026"],
      ["America/Vancouver", "bc-permanent-time-2026"],
      ["America/Winnipeg", "mb-permanent-time-2026"]
    ])("governs %s under %s", (timeZoneId, ruleId) => {
      expect(inspectTimeZoneSupport({ timeZoneId })).toMatchObject({ ruleId });
    });

    it.each([
      "America/Dawson_Creek",
      "America/Fort_Nelson",
      "America/Creston",
      "America/Toronto",
      "Etc/GMT+6",
      "UTC",
      "-06:00"
    ])("reports not_applicable for the ungoverned zone %s", (timeZoneId) => {
      expect(inspectTimeZoneSupport({ timeZoneId })).toEqual({
        status: "not_applicable",
        timeZoneId
      });
    });

    it.each(["Not/AZone", "", " ", "America/Edmonton!"])(
      "reports unknown for the unrecognized identifier %j without throwing",
      (timeZoneId) => {
        expect(inspectTimeZoneSupport({ timeZoneId })).toEqual({
          status: "unknown",
          timeZoneId
        });
      }
    );
  });

  describe("governed zones", () => {
    it("reports current before first divergence, with no correction due", () => {
      const result = inspectTimeZoneSupport({
        timeZoneId: "America/Edmonton",
        instant: "2026-06-01T00:00:00Z"
      });
      expect(result).toEqual({
        status: "current",
        timeZoneId: "America/Edmonton",
        ruleId: "ab-permanent-time-2026",
        expectedOffset: "-06:00",
        observedOffset: "-06:00",
        firstDivergence: "2026-11-01T02:00:00-06:00"
      });
    });

    it("reports current at Alberta's legal commencement, before its first divergence", () => {
      const result = inspectTimeZoneSupport({
        timeZoneId: "America/Edmonton",
        instant: "2026-06-18T00:00:00-06:00"
      });
      expect(result.status).toBe("current");
    });

    it("reports current at British Columbia's legal commencement, before its first divergence", () => {
      const result = inspectTimeZoneSupport({
        timeZoneId: "America/Vancouver",
        instant: "2026-03-09T00:00:00-07:00"
      });
      expect(result.status).toBe("current");
    });

    it("reports stale on a legacy host after first divergence", () => {
      const result = inspectTimeZoneSupport({
        timeZoneId: "America/Edmonton",
        instant: "2026-11-02T12:00:00Z"
      });
      expect(result).toEqual({
        status: "stale",
        timeZoneId: "America/Edmonton",
        ruleId: "ab-permanent-time-2026",
        expectedOffset: "-06:00",
        observedOffset: "-07:00",
        firstDivergence: "2026-11-01T02:00:00-06:00"
      });
    });

    it("reports current on an updated host after first divergence", () => {
      hostState.tzdata = "current";
      const result = inspectTimeZoneSupport({
        timeZoneId: "America/Edmonton",
        instant: "2026-11-02T12:00:00Z"
      });
      expect(result).toMatchObject({
        status: "current",
        expectedOffset: "-06:00",
        observedOffset: "-06:00"
      });
    });

    it.each([
      ["America/Edmonton", "-06:00", "-07:00", "2026-11-01T02:00:00-06:00"],
      ["America/Vancouver", "-07:00", "-08:00", "2026-11-01T02:00:00-07:00"],
      ["America/Winnipeg", "-05:00", "-06:00", "2026-11-01T02:00:00-05:00"]
    ])(
      "diagnoses %s as expecting %s where a legacy host reports %s",
      (timeZoneId, expectedOffset, observedOffset, firstDivergence) => {
        const result = inspectTimeZoneSupport({
          timeZoneId,
          instant: "2026-12-25T12:00:00Z"
        });
        expect(result).toMatchObject({
          status: "stale",
          expectedOffset,
          observedOffset,
          firstDivergence
        });
      }
    );

    it("switches from current to stale exactly at the first divergence instant", () => {
      const at = (instant: string) =>
        inspectTimeZoneSupport({ timeZoneId: "America/Edmonton", instant })
          .status;
      expect(at("2026-11-01T07:59:59Z")).toBe("current");
      expect(at("2026-11-01T08:00:00Z")).toBe("stale");
      expect(at("2026-11-01T08:00:01Z")).toBe("stale");
    });

    it("stays stale on a legacy host through the following summer, when the seasons coincide", () => {
      // A legacy host falls back and springs forward again; the rule keeps
      // the permanent offset throughout, so both agree next summer.
      expect(
        inspectTimeZoneSupport({
          timeZoneId: "America/Edmonton",
          instant: "2027-01-15T12:00:00Z"
        }).status
      ).toBe("stale");
      expect(
        inspectTimeZoneSupport({
          timeZoneId: "America/Edmonton",
          instant: "2027-07-15T12:00:00Z"
        }).status
      ).toBe("current");
    });

    it("returns a frozen result", () => {
      expect(
        Object.isFrozen(
          inspectTimeZoneSupport({ timeZoneId: "America/Edmonton" })
        )
      ).toBe(true);
      expect(
        Object.isFrozen(
          inspectTimeZoneSupport({ timeZoneId: "America/Toronto" })
        )
      ).toBe(true);
    });

    it("throws Temporal's RangeError for a malformed instant", () => {
      expect(() =>
        inspectTimeZoneSupport({
          timeZoneId: "America/Edmonton",
          instant: "not-an-instant"
        })
      ).toThrow(RangeError);
    });
  });

  describe("rule-owned probe", () => {
    it.each<SimulatedTzdata>(["stale", "current"])(
      "matches an explicit probe at first divergence on a %s host",
      (tzdata) => {
        hostState.tzdata = tzdata;
        const probed = inspectTimeZoneSupport({
          timeZoneId: "America/Edmonton"
        });
        const explicit = inspectTimeZoneSupport({
          timeZoneId: "America/Edmonton",
          instant: "2026-11-01T02:00:00-06:00"
        });
        expect(probed.status).toBe(tzdata);
        expect(probed).toEqual(explicit);
      }
    );

    it.each([
      ["America/Edmonton", "-06:00", "-07:00"],
      ["America/Vancouver", "-07:00", "-08:00"],
      ["America/Winnipeg", "-05:00", "-06:00"]
    ])(
      "probes %s at its own first divergence",
      (timeZoneId, expectedOffset, observedOffset) => {
        expect(inspectTimeZoneSupport({ timeZoneId })).toMatchObject({
          status: "stale",
          expectedOffset,
          observedOffset
        });
      }
    );
  });
});
