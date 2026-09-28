import { beforeEach, describe, expect, it, vi } from "vitest";
import { observeNextTransition } from "../src/host.js";
import { inspectTimeZoneSupport as inspect } from "../src/inspect.js";
import { rules } from "../src/rules.js";
import type {
  HostModule,
  SimulatedHostState,
  SimulatedScalarTzdata
} from "./fixtures/simulated-host.js";
import { hotpatch, temporal } from "./fixtures/temporal.js";

const { inspectHostSupport } = hotpatch;

/** `inspectTimeZoneSupport` on the supplied namespace. */
const inspectTimeZoneSupport = (timeZoneId: string, instant?: string) =>
  inspect(temporal, timeZoneId, instant);

const hostState = vi.hoisted<SimulatedHostState>(() => ({ tzdata: "stale" }));

// The runner's own tzdata may or may not know the 2026 Canadian rules, so
// every governed-zone observation is served by a deterministic simulation.
vi.mock("../src/host.js", async (importOriginal) => {
  const actual = await importOriginal<HostModule>();
  const { simulatedHostModule } = await import("./fixtures/simulated-host.js");
  const simulated = simulatedHostModule(actual, hostState);
  return {
    ...simulated,
    observeNextTransition: vi.fn(simulated.observeNextTransition)
  };
});

beforeEach(() => {
  hostState.tzdata = "stale";
  vi.mocked(observeNextTransition).mockClear();
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
      // assert
      expect(inspectTimeZoneSupport(timeZoneId).timeZoneId).toBe(canonical);
    });

    it.each([
      ["America/Edmonton", "ab-permanent-time-2026"],
      ["America/Vancouver", "bc-permanent-time-2026"],
      ["America/Winnipeg", "mb-permanent-time-2026"],
      ["America/Yellowknife", "nt-yellowknife-permanent-time-2026"],
      ["America/Inuvik", "nt-inuvik-permanent-time-2026"]
    ])("governs %s under %s", (timeZoneId, ruleId) => {
      // assert
      expect(inspectTimeZoneSupport(timeZoneId)).toMatchObject({ ruleId });
    });

    it.each([
      "America/Dawson_Creek",
      "America/Fort_Nelson",
      "America/Creston",
      "America/Cambridge_Bay",
      "America/Toronto",
      "america/toronto",
      "Etc/GMT+6",
      "UTC",
      "-06:00"
    ])("reports not_applicable for the ungoverned zone %s", (timeZoneId) => {
      // assert
      expect(inspectTimeZoneSupport(timeZoneId)).toEqual({
        status: "not_applicable",
        timeZoneId
      });
    });

    it.each(["Not/AZone", "", " ", "America/Edmonton!"])(
      "reports unknown for the unrecognized identifier %j without throwing",
      (timeZoneId) => {
        // assert
        expect(inspectTimeZoneSupport(timeZoneId)).toEqual({
          status: "unknown",
          timeZoneId
        });
      }
    );
  });

  describe("governed zones", () => {
    it("reports current before first divergence, with no correction due", () => {
      // assert
      expect(
        inspectTimeZoneSupport("America/Edmonton", "2026-06-01T00:00:00Z")
      ).toEqual({
        status: "current",
        timeZoneId: "America/Edmonton",
        ruleId: "ab-permanent-time-2026"
      });
    });

    it("reports current at Alberta's legal commencement, before its first divergence", () => {
      // assert
      expect(
        inspectTimeZoneSupport("America/Edmonton", "2026-06-18T00:00:00-06:00")
          .status
      ).toBe("current");
    });

    it("reports current at British Columbia's legal commencement, before its first divergence", () => {
      // assert
      expect(
        inspectTimeZoneSupport("America/Vancouver", "2026-03-09T00:00:00-07:00")
          .status
      ).toBe("current");
    });

    it("reports stale on a legacy host after first divergence", () => {
      // assert
      expect(
        inspectTimeZoneSupport("America/Edmonton", "2026-11-02T12:00:00Z")
      ).toEqual({
        status: "stale",
        timeZoneId: "America/Edmonton",
        ruleId: "ab-permanent-time-2026"
      });
    });

    it("reports current on an updated host after first divergence", () => {
      // arrange
      hostState.tzdata = "current";
      // assert
      expect(
        inspectTimeZoneSupport("America/Edmonton", "2026-11-02T12:00:00Z")
          .status
      ).toBe("current");
    });

    it.each([
      ["America/Edmonton", "ab-permanent-time-2026"],
      ["America/Vancouver", "bc-permanent-time-2026"],
      ["America/Winnipeg", "mb-permanent-time-2026"],
      ["America/Yellowknife", "nt-yellowknife-permanent-time-2026"],
      ["America/Inuvik", "nt-inuvik-permanent-time-2026"]
    ])("classifies %s as stale on a legacy host", (timeZoneId, ruleId) => {
      // assert
      expect(
        inspectTimeZoneSupport(timeZoneId, "2026-12-25T12:00:00Z")
      ).toEqual({ status: "stale", timeZoneId, ruleId });
    });

    it.each([
      ["America/Yellowknife", "nt-yellowknife-permanent-time-2026"],
      ["America/Inuvik", "nt-inuvik-permanent-time-2026"]
    ])("classifies %s as current on an updated host", (timeZoneId, ruleId) => {
      // arrange
      hostState.tzdata = "current";
      // assert
      expect(
        inspectTimeZoneSupport(timeZoneId, "2026-12-25T12:00:00Z")
      ).toEqual({ status: "current", timeZoneId, ruleId });
    });

    it.each(["America/Yellowknife", "America/Inuvik"])(
      "reports %s current on a seasonal host before its first divergence",
      (timeZoneId) => {
        // assert
        expect(
          inspectTimeZoneSupport(timeZoneId, "2026-09-01T12:00:00Z").status
        ).toBe("current");
      }
    );

    it("switches from current to stale exactly at the first divergence instant", () => {
      // act
      const at = (instant: string) =>
        inspectTimeZoneSupport("America/Edmonton", instant).status;
      // assert
      expect(at("2026-11-01T07:59:59Z")).toBe("current");
      expect(at("2026-11-01T08:00:00Z")).toBe("stale");
      expect(at("2026-11-01T08:00:01Z")).toBe("stale");
    });

    it("stays stale on a legacy host through the following summer, even where the offsets coincide", () => {
      // The verdict belongs to the rule from first divergence onwards: a
      // legacy host is stale year-round, even in its daylight period when
      // its offset happens to match the rule's.
      // assert
      expect(
        inspectTimeZoneSupport("America/Edmonton", "2027-01-15T12:00:00Z")
          .status
      ).toBe("stale");
      expect(
        inspectTimeZoneSupport("America/Edmonton", "2027-07-15T12:00:00Z")
          .status
      ).toBe("stale");
    });

    it("returns a frozen result", () => {
      // assert
      expect(Object.isFrozen(inspectTimeZoneSupport("America/Edmonton"))).toBe(
        true
      );
      expect(Object.isFrozen(inspectTimeZoneSupport("America/Toronto"))).toBe(
        true
      );
    });

    it("throws Temporal's RangeError for a malformed instant", () => {
      // assert
      expect(() =>
        inspectTimeZoneSupport("America/Edmonton", "not-an-instant")
      ).toThrow(RangeError);
    });

    it("throws Temporal's RangeError for a malformed instant in a zone the host cannot observe", () => {
      // arrange
      hostState.tzdata = { "America/Edmonton": "unavailable" };
      // assert
      expect(() =>
        inspectTimeZoneSupport("America/Edmonton", "not-an-instant")
      ).toThrow(RangeError);
    });
  });

  describe("rule-owned probe", () => {
    it.each<SimulatedScalarTzdata>(["stale", "current"])(
      "matches an explicit probe at first divergence on a %s host",
      (tzdata) => {
        // arrange
        hostState.tzdata = tzdata;
        const probed = inspectTimeZoneSupport("America/Edmonton");
        // act
        const explicit = inspectTimeZoneSupport(
          "America/Edmonton",
          "2026-11-01T02:00:00-06:00"
        );
        // assert
        expect(probed.status).toBe(tzdata);
        expect(probed).toEqual(explicit);
      }
    );

    it.each([
      ["America/Edmonton"],
      ["America/Vancouver"],
      ["America/Winnipeg"],
      ["America/Yellowknife"],
      ["America/Inuvik"]
    ])("probes %s at its own first divergence", (timeZoneId) => {
      // assert
      expect(inspectTimeZoneSupport(timeZoneId)).toMatchObject({
        status: "stale",
        timeZoneId
      });
    });
  });

  describe("a host that adopted the rule and later revised it", () => {
    // A revision that happened before this test was written, well within
    // reach.
    const revisedAt = "2027-11-07T02:00:00-07:00";

    beforeEach(() => {
      hostState.tzdata = { "America/Edmonton": { revisedAt } };
    });

    it("reports rule_outdated at first divergence", () => {
      // assert
      expect(inspectTimeZoneSupport("America/Edmonton")).toEqual({
        status: "rule_outdated",
        timeZoneId: "America/Edmonton",
        ruleId: "ab-permanent-time-2026"
      });
    });

    it("reports rule_outdated before the revision takes effect", () => {
      // assert
      expect(
        inspectTimeZoneSupport("America/Edmonton", "2027-06-01T12:00:00Z")
          .status
      ).toBe("rule_outdated");
    });

    it("reports rule_outdated after the revision takes effect", () => {
      // assert
      expect(
        inspectTimeZoneSupport("America/Edmonton", "2028-01-15T12:00:00Z")
          .status
      ).toBe("rule_outdated");
    });

    it("keeps reporting rule_outdated when the revision lies beyond every instant read", () => {
      // arrange
      hostState.tzdata = {
        "America/Edmonton": { revisedAt: "2099-01-01T00:00:00Z" }
      };
      // assert
      expect(
        inspectTimeZoneSupport("America/Edmonton", "2026-12-25T12:00:00Z")
          .status
      ).toBe("rule_outdated");
    });

    it("reports current before first divergence, unaffected by a later revision", () => {
      // assert
      expect(
        inspectTimeZoneSupport("America/Edmonton", "2026-06-01T00:00:00Z")
          .status
      ).toBe("current");
    });
  });
});

describe("inspectHostSupport", () => {
  it("reports every rule stale on a legacy host, in rule-table order", () => {
    // assert
    expect(inspectHostSupport()).toEqual({
      ruleSupport: [
        { ruleId: "ab-permanent-time-2026", status: "stale" },
        { ruleId: "bc-permanent-time-2026", status: "stale" },
        { ruleId: "mb-permanent-time-2026", status: "stale" },
        { ruleId: "nt-yellowknife-permanent-time-2026", status: "stale" },
        { ruleId: "nt-inuvik-permanent-time-2026", status: "stale" }
      ]
    });
  });

  it("reports every rule current on an updated host", () => {
    // arrange
    hostState.tzdata = "current";
    // assert
    expect(inspectHostSupport()).toEqual({
      ruleSupport: [
        { ruleId: "ab-permanent-time-2026", status: "current" },
        { ruleId: "bc-permanent-time-2026", status: "current" },
        { ruleId: "mb-permanent-time-2026", status: "current" },
        { ruleId: "nt-yellowknife-permanent-time-2026", status: "current" },
        { ruleId: "nt-inuvik-permanent-time-2026", status: "current" }
      ]
    });
  });

  it("reports each rule's own status on a host stale in one rule and current in the others", () => {
    // arrange
    hostState.tzdata = {
      "America/Edmonton": "stale",
      "America/Vancouver": "current",
      "America/Winnipeg": "current",
      "America/Yellowknife": "current",
      "America/Inuvik": "current"
    };
    // assert
    expect(inspectHostSupport()).toEqual({
      ruleSupport: [
        { ruleId: "ab-permanent-time-2026", status: "stale" },
        { ruleId: "bc-permanent-time-2026", status: "current" },
        { ruleId: "mb-permanent-time-2026", status: "current" },
        { ruleId: "nt-yellowknife-permanent-time-2026", status: "current" },
        { ruleId: "nt-inuvik-permanent-time-2026", status: "current" }
      ]
    });
  });

  it("reports a governed zone the host cannot observe as stale", () => {
    // arrange
    hostState.tzdata = {
      "America/Edmonton": "current",
      "America/Vancouver": "unavailable",
      "America/Winnipeg": "current",
      "America/Yellowknife": "current",
      "America/Inuvik": "current"
    };
    // assert
    expect(inspectHostSupport()).toEqual({
      ruleSupport: [
        { ruleId: "ab-permanent-time-2026", status: "current" },
        { ruleId: "bc-permanent-time-2026", status: "stale" },
        { ruleId: "mb-permanent-time-2026", status: "current" },
        { ruleId: "nt-yellowknife-permanent-time-2026", status: "current" },
        { ruleId: "nt-inuvik-permanent-time-2026", status: "current" }
      ]
    });
  });

  it("has one ruleSupport entry per exported rule, in the same order", () => {
    // act
    const support = inspectHostSupport();
    // assert
    expect(support.ruleSupport.map((entry) => entry.ruleId)).toEqual(
      rules.map((rule) => rule.ruleId)
    );
  });

  it("reports Inuvik's rule alone as stale on a host current for the others", () => {
    // arrange
    hostState.tzdata = {
      "America/Edmonton": "current",
      "America/Vancouver": "current",
      "America/Winnipeg": "current",
      "America/Yellowknife": "current",
      "America/Inuvik": "stale"
    };
    // assert
    expect(inspectHostSupport()).toEqual({
      ruleSupport: [
        { ruleId: "ab-permanent-time-2026", status: "current" },
        { ruleId: "bc-permanent-time-2026", status: "current" },
        { ruleId: "mb-permanent-time-2026", status: "current" },
        { ruleId: "nt-yellowknife-permanent-time-2026", status: "current" },
        { ruleId: "nt-inuvik-permanent-time-2026", status: "stale" }
      ]
    });
  });

  it("reports each rule's own status when one is stale and another outdated", () => {
    // arrange
    hostState.tzdata = {
      "America/Edmonton": { revisedAt: "2027-11-07T02:00:00-07:00" },
      "America/Vancouver": "stale",
      "America/Winnipeg": "current",
      "America/Yellowknife": "current",
      "America/Inuvik": "current"
    };
    // assert
    expect(inspectHostSupport()).toEqual({
      ruleSupport: [
        { ruleId: "ab-permanent-time-2026", status: "rule_outdated" },
        { ruleId: "bc-permanent-time-2026", status: "stale" },
        { ruleId: "mb-permanent-time-2026", status: "current" },
        { ruleId: "nt-yellowknife-permanent-time-2026", status: "current" },
        { ruleId: "nt-inuvik-permanent-time-2026", status: "current" }
      ]
    });
  });

  it("returns a frozen result with a frozen rule list", () => {
    // act
    const support = inspectHostSupport();
    // assert
    expect(Object.isFrozen(support)).toBe(true);
    expect(Object.isFrozen(support.ruleSupport)).toBe(true);
    for (const entry of support.ruleSupport) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });
});

describe("the host's verdict on a rule", () => {
  // Corrections run in render paths, so the transition search behind
  // `rule_outdated` must not repeat per call.
  it("is observed once, however many calls and instants ask for it", () => {
    // arrange
    // A fresh record, so no earlier case has observed this host's data.
    hostState.tzdata = { "America/Edmonton": "current" };
    const instants = [
      undefined,
      "2026-12-25T12:00:00Z",
      "2030-01-01T00:00:00Z"
    ];

    // act
    for (const instant of instants) {
      inspectTimeZoneSupport("America/Edmonton", instant);
      inspectTimeZoneSupport("Canada/Mountain", instant);
    }
    inspectHostSupport();

    // assert
    expect(
      vi
        .mocked(observeNextTransition)
        .mock.calls.filter(([zone]) => zone === "America/Edmonton")
    ).toHaveLength(1);
  });
});
