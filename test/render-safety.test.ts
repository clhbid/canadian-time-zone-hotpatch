/**
 * Pins render safety by construction rather than by example: an arbitrary
 * string is generated for every input, so this fails for any input that
 * makes a render-safe function throw, not only the few bad inputs a person
 * thought to write down.
 */
import fc from "fast-check";
import { describe, it } from "vitest";
import { hotpatch } from "./fixtures/temporal.js";

const { inspectTimeZoneSupport, toTimeZoneLabel } = hotpatch;

describe("render safety", () => {
  it("inspectTimeZoneSupport never throws for an arbitrary timeZoneId", () => {
    fc.assert(
      fc.property(fc.string(), (timeZoneId) => {
        inspectTimeZoneSupport(timeZoneId);
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
