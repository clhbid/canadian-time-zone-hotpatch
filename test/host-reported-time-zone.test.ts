/**
 * Pins what each entry point does with the zone values hosts actually
 * report, typed or not: some Chrome and Edge hosts on Windows report no zone
 * at all, so a non-string must be handled exactly as `""` is.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as pkg from "../src/index.js";
import { UnknownTimeZoneError } from "../src/index.js";
import type {
  HostModule,
  SimulatedHostState
} from "./fixtures/simulated-host.js";
import { hotpatch, temporal } from "./fixtures/temporal.js";

const hostState = vi.hoisted<SimulatedHostState>(() => ({ tzdata: "stale" }));

vi.mock("../src/host.js", async (importOriginal) => {
  const actual = await importOriginal<HostModule>();
  const { simulatedHostModule } = await import("./fixtures/simulated-host.js");
  return simulatedHostModule(actual, hostState);
});

beforeEach(() => {
  hostState.tzdata = "stale";
  vi.stubGlobal("Temporal", temporal);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const instant = "2026-12-25T12:00:00Z";
const wallTime = "2026-12-25T05:00:00";

describe.each([
  ["the default exports", pkg],
  ["a createHotpatch result", hotpatch]
])("%s", (_, api) => {
  // A host value typed as `string` that is not one at run time.
  const untyped = (value: unknown) => value as string;

  describe.each([
    ["undefined", untyped(undefined)],
    ["null", untyped(null)],
    ['""', ""],
    ['"Etc/Unknown"', "Etc/Unknown"],
    ['"Mars/Olympus"', "Mars/Olympus"]
  ])("for the unusable zone %s", (_, timeZoneId) => {
    // An unusable string is reported as given; a non-string as `""`.
    const reported = typeof timeZoneId === "string" ? timeZoneId : "";

    it("inspectTimeZoneSupport reports unknown", () => {
      // assert
      expect(api.inspectTimeZoneSupport(timeZoneId)).toEqual({
        status: "unknown",
        timeZoneId: reported
      });
    });

    it("toCorrectedZonedTime throws UnknownTimeZoneError", () => {
      // assert
      expect(() => api.toCorrectedZonedTime({ instant, timeZoneId })).toThrow(
        new UnknownTimeZoneError(reported)
      );
    });

    it("toCorrectedInstant throws UnknownTimeZoneError", () => {
      // assert
      expect(() =>
        api.toCorrectedInstant({
          wallTime,
          timeZoneId,
          disambiguation: "compatible"
        })
      ).toThrow(new UnknownTimeZoneError(reported));
    });

    it("toTimeZoneLabel returns undefined", () => {
      // assert
      expect(api.toTimeZoneLabel({ instant, timeZoneId })).toBeUndefined();
    });
  });

  describe.each([
    ["UTC", "+00:00"],
    ["Etc/GMT+7", "-07:00"],
    ["+00:00", "+00:00"],
    ["Asia/Calcutta", "+05:30"],
    ["America/Coral_Harbour", "-05:00"]
  ])("for the ungoverned zone %s", (timeZoneId, offset) => {
    const support = { status: "not_applicable", timeZoneId };

    it("inspectTimeZoneSupport reports not_applicable", () => {
      // assert
      expect(api.inspectTimeZoneSupport(timeZoneId)).toEqual(support);
    });

    it("toCorrectedZonedTime keeps the zone", () => {
      // assert
      expect(api.toCorrectedZonedTime({ instant, timeZoneId })).toEqual({
        instant,
        timeZoneId,
        offset,
        support
      });
    });

    it("toCorrectedInstant keeps the zone", () => {
      // act
      const result = api.toCorrectedInstant({
        wallTime,
        timeZoneId,
        disambiguation: "compatible"
      });

      // assert
      expect(result).toEqual({
        instant: temporal.PlainDateTime.from(wallTime)
          .toZonedDateTime(timeZoneId)
          .toInstant()
          .toString(),
        timeZoneId,
        offset,
        support
      });
    });

    it("toTimeZoneLabel returns undefined", () => {
      // assert
      expect(api.toTimeZoneLabel({ instant, timeZoneId })).toBeUndefined();
    });
  });

  describe.each(["america/edmonton", "Canada/Mountain"])(
    "for the Alberta identifier %s on a stale host",
    (timeZoneId) => {
      const support = {
        status: "stale",
        timeZoneId: "America/Edmonton",
        ruleId: "ab-permanent-time-2026"
      };

      it("inspectTimeZoneSupport reports the Alberta rule's verdict", () => {
        // assert
        expect(api.inspectTimeZoneSupport(timeZoneId)).toEqual(support);
      });

      it("toCorrectedZonedTime corrects per the rule", () => {
        // assert
        expect(api.toCorrectedZonedTime({ instant, timeZoneId })).toEqual({
          instant,
          timeZoneId: "Etc/GMT+6",
          offset: "-06:00",
          support
        });
      });

      it("toCorrectedInstant corrects per the rule", () => {
        // assert
        expect(
          api.toCorrectedInstant({
            wallTime,
            timeZoneId,
            disambiguation: "compatible"
          })
        ).toEqual({
          instant: "2026-12-25T11:00:00Z",
          timeZoneId: "Etc/GMT+6",
          offset: "-06:00",
          support
        });
      });

      it("toTimeZoneLabel returns the rule's label", () => {
        // assert
        expect(api.toTimeZoneLabel({ instant, timeZoneId })).toEqual({
          long: "Alberta Time",
          short: "ABT"
        });
      });
    }
  );
});
