import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HostModule } from "./fixtures/simulated-host.js";
import { inspectTimeZoneSupport } from "../src/index.js";

const hostState = vi.hoisted(() => ({ tzdata: "stale" as "stale" | "current" }));

// The runner's own tzdata may or may not know about the 2026 Canadian rules,
// so every host observation is served by a deterministic simulation instead.
vi.mock("../src/host.js", async (importOriginal) => {
  const actual = await importOriginal<HostModule>();
  const { simulatedHostModule } = await import("./fixtures/simulated-host.js");
  return simulatedHostModule(actual, hostState);
});

beforeEach(() => {
  hostState.tzdata = "stale";
});

describe("inspectTimeZoneSupport", () => {
  it("reports current for a governed zone before its rule diverges", () => {
    const result = inspectTimeZoneSupport({
      timeZoneId: "America/Edmonton",
      instant: "2026-06-01T00:00:00Z",
    });
    expect(result.status).toBe("current");
    expect(result.ruleId).toBe("ab-permanent-time-2026");
  });

  it("reports stale on an unpatched host after the rule diverges", () => {
    const result = inspectTimeZoneSupport({
      timeZoneId: "America/Edmonton",
      instant: "2026-11-02T12:00:00Z",
    });
    expect(result.status).toBe("stale");
    expect(result.expectedOffset).toBe("-06:00");
    expect(result.observedOffset).toBe("-07:00");
    expect(result.firstDivergence).toBe("2026-11-01T02:00:00-06:00");
  });

  it("reports current on a host whose tzdata already knows the rule", () => {
    hostState.tzdata = "current";
    const result = inspectTimeZoneSupport({
      timeZoneId: "America/Edmonton",
      instant: "2026-11-02T12:00:00Z",
    });
    expect(result.status).toBe("current");
    expect(result.expectedOffset).toBe("-06:00");
    expect(result.observedOffset).toBe("-06:00");
  });

  it("performs an unbiased rule-owned probe when no instant is given", () => {
    const result = inspectTimeZoneSupport({ timeZoneId: "America/Edmonton" });
    expect(result.status).toBe("stale");
    expect(result.ruleId).toBe("ab-permanent-time-2026");
  });

  it.each([
    ["America/Edmonton", "ab-permanent-time-2026"],
    ["America/Vancouver", "bc-permanent-time-2026"],
    ["America/Winnipeg", "mb-permanent-time-2026"],
  ])("governs %s under rule %s", (timeZoneId, ruleId) => {
    const result = inspectTimeZoneSupport({ timeZoneId });
    expect(result.ruleId).toBe(ruleId);
  });

  it.each([
    ["Canada/Mountain", "America/Edmonton"],
    ["Canada/Pacific", "America/Vancouver"],
    ["Canada/Central", "America/Winnipeg"],
  ])("normalizes the alias %s to %s", (alias, canonical) => {
    const result = inspectTimeZoneSupport({ timeZoneId: alias });
    expect(result.timeZoneId).toBe(canonical);
  });

  it("reports not_applicable for a valid but ungoverned zone", () => {
    const result = inspectTimeZoneSupport({ timeZoneId: "America/Toronto" });
    expect(result).toEqual({ status: "not_applicable", timeZoneId: "America/Toronto" });
  });

  it.each(["America/Dawson_Creek", "America/Fort_Nelson"])(
    "reports not_applicable for the unaffected B.C. regional zone %s",
    (timeZoneId) => {
      const result = inspectTimeZoneSupport({ timeZoneId });
      expect(result.status).toBe("not_applicable");
    },
  );

  it("reports unknown for an unrecognized identifier", () => {
    const result = inspectTimeZoneSupport({ timeZoneId: "Not/AZone" });
    expect(result).toEqual({ status: "unknown", timeZoneId: "Not/AZone" });
  });

  it("does not throw for malformed zone identifiers", () => {
    expect(() => inspectTimeZoneSupport({ timeZoneId: "" })).not.toThrow();
    expect(inspectTimeZoneSupport({ timeZoneId: "" }).status).toBe("unknown");
  });

  it("agrees with resolution just before, at, and after the divergence instant", () => {
    const before = inspectTimeZoneSupport({
      timeZoneId: "America/Edmonton",
      instant: "2026-11-01T07:59:00Z",
    });
    const at = inspectTimeZoneSupport({
      timeZoneId: "America/Edmonton",
      instant: "2026-11-01T08:00:00Z",
    });
    const after = inspectTimeZoneSupport({
      timeZoneId: "America/Edmonton",
      instant: "2026-11-01T08:01:00Z",
    });
    expect(before.status).toBe("current");
    expect(at.status).toBe("stale");
    expect(after.status).toBe("stale");
  });
});
