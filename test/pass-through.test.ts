/**
 * Differential spec for the pass-through guarantee in the README: for a zone
 * outside the rule table, this package returns exactly what the host returns.
 *
 * `src/host.js` is deliberately unmocked here — the property under test is
 * agreement with the real host, so both sides read the same tzdata.
 */
import { describe, expect, it } from "vitest";
import { UnknownTimeZoneError } from "../src/index.js";
import { rules } from "../src/rules.js";
import type { Disambiguation } from "../src/types.js";
import { hotpatch, temporal } from "./fixtures/temporal.js";

const {
  inspectTimeZoneSupport,
  toCorrectedInstant,
  toCorrectedZonedTime,
  toTimeZoneLabel
} = hotpatch;

/** Every canonical id and alias the rule table governs, matched case-insensitively. */
const governedIds = new Set(
  rules.flatMap((rule) => [
    rule.canonicalTimeZoneId.toLowerCase(),
    ...rule.aliases.map((alias) => alias.toLowerCase())
  ])
);

/** Backward links applications store that `Intl.supportedValuesOf` omits. */
const backwardLinks: readonly string[] = [
  "America/Yellowknife",
  "America/Montreal",
  "US/Arizona",
  "Europe/Kiev",
  "Asia/Calcutta"
];

const isUngoverned = (timeZoneId: string): boolean =>
  !governedIds.has(timeZoneId.toLowerCase());

/** The zones under test: enumerated plus named links, less the governed ones. */
const ungovernedZones = Array.from(
  new Set([...Intl.supportedValuesOf("timeZone"), ...backwardLinks])
).filter(isUngoverned);

/** An ordinary day in each half of the year, and the 2026 fall-back morning. */
const instants: readonly string[] = [
  "2026-01-15T12:00:00Z",
  "2026-06-15T12:00:00Z",
  "2026-11-01T02:00:00Z",
  "2026-11-01T09:30:00Z"
];

/** Wall-clock readings, including ones many zones repeat or skip. */
const wallTimes: readonly string[] = [
  "2026-06-15T10:00:00",
  "2026-11-01T01:30:00",
  "2027-03-14T02:30:00"
];

const disambiguations: readonly Disambiguation[] = [
  "compatible",
  "earlier",
  "later",
  "reject"
];

describe("ungoverned zone pass-through", () => {
  // A derivation that excluded everything would leave every case below
  // vacuously passing.
  it("derives a non-empty set of zones outside the rule table", () => {
    expect(ungovernedZones.length).toBeGreaterThan(300);
  });

  it("keeps the backward links the rule table does not govern", () => {
    const links = backwardLinks.filter(isUngoverned);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(ungovernedZones).toContain(link);
    }
  });

  describe.each(ungovernedZones)("%s", (timeZoneId) => {
    it("corrects an instant to exactly what the host returns", () => {
      for (const instant of instants) {
        const expected =
          temporal.Instant.from(instant).toZonedDateTimeISO(timeZoneId);

        const result = toCorrectedZonedTime({ instant, timeZoneId });

        expect(result.instant).toBe(expected.toInstant().toString());
        expect(result.offset).toBe(expected.offset);
        expect(result.timeZoneId).toBe(expected.timeZoneId);
      }
    });

    it("resolves a wall-clock reading to exactly the instant the host assigns", () => {
      for (const wallTime of wallTimes) {
        const local = temporal.PlainDateTime.from(wallTime);
        for (const disambiguation of disambiguations) {
          let expected: ReturnType<typeof local.toZonedDateTime> | undefined;
          try {
            expected = local.toZonedDateTime(timeZoneId, { disambiguation });
          } catch {
            expected = undefined;
          }

          if (expected === undefined) {
            expect(() =>
              toCorrectedInstant({ wallTime, timeZoneId, disambiguation })
            ).toThrow(RangeError);
            continue;
          }

          const result = toCorrectedInstant({
            wallTime,
            timeZoneId,
            disambiguation
          });
          expect(result.instant).toBe(expected.toInstant().toString());
          expect(result.offset).toBe(expected.offset);
          expect(result.timeZoneId).toBe(expected.timeZoneId);
        }
      }
    });

    it("reports not_applicable and no label", () => {
      expect(inspectTimeZoneSupport(timeZoneId)).toEqual({
        status: "not_applicable",
        timeZoneId
      });
      expect(
        toTimeZoneLabel({ instant: instants[0]!, timeZoneId })
      ).toBeUndefined();
    });
  });

  it("reports unknown, and throws UnknownTimeZoneError, for a host-rejected identifier", () => {
    const timeZoneId = "Not/AZone";
    expect(inspectTimeZoneSupport(timeZoneId)).toEqual({
      status: "unknown",
      timeZoneId
    });
    expect(() =>
      toCorrectedZonedTime({ instant: instants[0]!, timeZoneId })
    ).toThrow(UnknownTimeZoneError);
    expect(() =>
      toCorrectedInstant({
        wallTime: wallTimes[0]!,
        timeZoneId,
        disambiguation: "compatible"
      })
    ).toThrow(UnknownTimeZoneError);
  });
});
