/**
 * Pins render safety by construction rather than by example: an arbitrary
 * string is generated for every input, so this fails for any input that
 * makes a render-safe function throw, not only the few bad inputs a person
 * thought to write down.
 */
import fc from "fast-check";
import { describe, it } from "vitest";
import { TimeZoneSupportStatus } from "../src/types.js";
import { hotpatch } from "./fixtures/temporal.js";

const { inspectTimeZoneSupport, toCorrectedZonedTime, toTimeZoneLabel } =
  hotpatch;

/** Arbitrary strings, plus identifiers a host is likely to resolve. */
const timeZoneIds = fc.oneof(
  fc.string(),
  fc.constantFrom(
    "America/Edmonton",
    "America/Vancouver",
    "America/Winnipeg",
    "America/Toronto",
    "Etc/GMT+6",
    "UTC"
  )
);

describe("render safety", () => {
  it("inspectTimeZoneSupport never throws for an arbitrary timeZoneId", () => {
    fc.assert(
      fc.property(fc.string(), (timeZoneId) => {
        inspectTimeZoneSupport(timeZoneId);
      })
    );
  });

  // What makes the README's guard-then-correct pattern sound: a zone the
  // inspection declines to call `unknown` is one the correction can handle,
  // so the guarded branch cannot throw the error the guard is there to avoid.
  it("corrects without throwing for every zone the inspection clears", () => {
    fc.assert(
      fc.property(timeZoneIds, (timeZoneId) => {
        if (
          inspectTimeZoneSupport(timeZoneId).status ===
          TimeZoneSupportStatus.unknown
        ) {
          return;
        }

        toCorrectedZonedTime({ instant: "2026-11-15T19:00:00Z", timeZoneId });
      })
    );
  });

  it("toTimeZoneLabel never throws for arbitrary instant and timeZoneId strings", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (instant, timeZoneId) => {
        toTimeZoneLabel({ instant, timeZoneId });
      })
    );
  });
});
