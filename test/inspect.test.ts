import { beforeEach, describe, expect, it, vi } from "vitest";
import { inspectHostSupport } from "../src/index.js";
import { inspectTimeZoneSupport } from "../src/inspect.js";
import type {
  HostModule,
  SimulatedHostState,
  SimulatedTzdata
} from "./fixtures/simulated-host.js";

const hostState = vi.hoisted<SimulatedHostState>(() => ({ tzdata: "stale" }));

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
      expect(inspectTimeZoneSupport(timeZoneId).timeZoneId).toBe(canonical);
    });

    it.each([
      ["America/Edmonton", "ab-permanent-time-2026"],
      ["America/Vancouver", "bc-permanent-time-2026"],
      ["America/Winnipeg", "mb-permanent-time-2026"]
    ])("governs %s under %s", (timeZoneId, ruleId) => {
      expect(inspectTimeZoneSupport(timeZoneId)).toMatchObject({ ruleId });
    });

    it.each([
      "America/Dawson_Creek",
      "America/Fort_Nelson",
      "America/Creston",
      "America/Toronto",
      "america/toronto",
      "Etc/GMT+6",
      "UTC",
      "-06:00"
    ])("reports not_applicable for the ungoverned zone %s", (timeZoneId) => {
      expect(inspectTimeZoneSupport(timeZoneId)).toEqual({
        status: "not_applicable",
        timeZoneId
      });
    });

    it.each(["Not/AZone", "", " ", "America/Edmonton!"])(
      "reports unknown for the unrecognized identifier %j without throwing",
      (timeZoneId) => {
        expect(inspectTimeZoneSupport(timeZoneId)).toEqual({
          status: "unknown",
          timeZoneId
        });
      }
    );
  });

  describe("governed zones", () => {
    it("reports current before first divergence, with no correction due", () => {
      expect(
        inspectTimeZoneSupport("America/Edmonton", "2026-06-01T00:00:00Z")
      ).toEqual({
        status: "current",
        timeZoneId: "America/Edmonton",
        ruleId: "ab-permanent-time-2026"
      });
    });

    it("reports current at Alberta's legal commencement, before its first divergence", () => {
      expect(
        inspectTimeZoneSupport("America/Edmonton", "2026-06-18T00:00:00-06:00")
          .status
      ).toBe("current");
    });

    it("reports current at British Columbia's legal commencement, before its first divergence", () => {
      expect(
        inspectTimeZoneSupport("America/Vancouver", "2026-03-09T00:00:00-07:00")
          .status
      ).toBe("current");
    });

    it("reports stale on a legacy host after first divergence", () => {
      expect(
        inspectTimeZoneSupport("America/Edmonton", "2026-11-02T12:00:00Z")
      ).toEqual({
        status: "stale",
        timeZoneId: "America/Edmonton",
        ruleId: "ab-permanent-time-2026"
      });
    });

    it("reports current on an updated host after first divergence", () => {
      hostState.tzdata = "current";
      expect(
        inspectTimeZoneSupport("America/Edmonton", "2026-11-02T12:00:00Z")
          .status
      ).toBe("current");
    });

    it.each([
      ["America/Edmonton", "ab-permanent-time-2026"],
      ["America/Vancouver", "bc-permanent-time-2026"],
      ["America/Winnipeg", "mb-permanent-time-2026"]
    ])("classifies %s as stale on a legacy host", (timeZoneId, ruleId) => {
      expect(
        inspectTimeZoneSupport(timeZoneId, "2026-12-25T12:00:00Z")
      ).toEqual({ status: "stale", timeZoneId, ruleId });
    });

    it("switches from current to stale exactly at the first divergence instant", () => {
      const at = (instant: string) =>
        inspectTimeZoneSupport("America/Edmonton", instant).status;
      expect(at("2026-11-01T07:59:59Z")).toBe("current");
      expect(at("2026-11-01T08:00:00Z")).toBe("stale");
      expect(at("2026-11-01T08:00:01Z")).toBe("stale");
    });

    it("stays stale on a legacy host through the following summer, when the seasons coincide", () => {
      // A legacy host falls back and springs forward again; the rule keeps
      // the permanent offset throughout, so both agree next summer.
      expect(
        inspectTimeZoneSupport("America/Edmonton", "2027-01-15T12:00:00Z")
          .status
      ).toBe("stale");
      expect(
        inspectTimeZoneSupport("America/Edmonton", "2027-07-15T12:00:00Z")
          .status
      ).toBe("current");
    });

    it("returns a frozen result", () => {
      expect(Object.isFrozen(inspectTimeZoneSupport("America/Edmonton"))).toBe(
        true
      );
      expect(Object.isFrozen(inspectTimeZoneSupport("America/Toronto"))).toBe(
        true
      );
    });

    it("throws Temporal's RangeError for a malformed instant", () => {
      expect(() =>
        inspectTimeZoneSupport("America/Edmonton", "not-an-instant")
      ).toThrow(RangeError);
    });
  });

  describe("rule-owned probe", () => {
    it.each<SimulatedTzdata>(["stale", "current"])(
      "matches an explicit probe at first divergence on a %s host",
      (tzdata) => {
        hostState.tzdata = tzdata;
        const probed = inspectTimeZoneSupport("America/Edmonton");
        const explicit = inspectTimeZoneSupport(
          "America/Edmonton",
          "2026-11-01T02:00:00-06:00"
        );
        expect(probed.status).toBe(tzdata);
        expect(probed).toEqual(explicit);
      }
    );

    it.each([
      ["America/Edmonton"],
      ["America/Vancouver"],
      ["America/Winnipeg"]
    ])("probes %s at its own first divergence", (timeZoneId) => {
      expect(inspectTimeZoneSupport(timeZoneId)).toMatchObject({
        status: "stale",
        timeZoneId
      });
    });
  });
});

describe("inspectHostSupport", () => {
  it("reports every rule stale on a legacy host, in rule-table order", () => {
    expect(inspectHostSupport()).toEqual({
      status: "stale",
      staleRuleIds: [
        "ab-permanent-time-2026",
        "bc-permanent-time-2026",
        "mb-permanent-time-2026"
      ]
    });
  });

  it("reports current with no stale rules on an updated host", () => {
    hostState.tzdata = "current";
    expect(inspectHostSupport()).toEqual({
      status: "current",
      staleRuleIds: []
    });
  });

  it("lists exactly the stale rules on a host stale in one rule and current in the others", () => {
    hostState.tzdata = {
      "America/Edmonton": "stale",
      "America/Vancouver": "current",
      "America/Winnipeg": "current"
    };
    expect(inspectHostSupport()).toEqual({
      status: "stale",
      staleRuleIds: ["ab-permanent-time-2026"]
    });
  });

  it("returns a frozen result with a frozen rule list", () => {
    const support = inspectHostSupport();
    expect(Object.isFrozen(support)).toBe(true);
    expect(Object.isFrozen(support.staleRuleIds)).toBe(true);
  });
});
