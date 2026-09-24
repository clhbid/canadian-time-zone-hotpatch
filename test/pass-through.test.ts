/**
 * Differential spec for the pass-through guarantee: for every zone outside
 * the rule table, this package returns exactly what host Temporal returns.
 *
 * Unlike the other correction specs, `src/host.js` is deliberately left
 * unmocked here — the property under test is agreement with the real host,
 * so a simulated host would prove nothing. The result does not depend on the
 * runner's tzdata: both sides read the same host, so this asserts agreement
 * rather than any particular offset.
 *
 * The ungoverned set is derived from the exported rule table (canonical ids
 * and aliases), never listed, so a new rule removes its zones from this spec
 * automatically. `Intl.supportedValuesOf("timeZone")` omits backward links —
 * the identifiers applications actually store — so a named list of them is
 * added alongside the enumerated set.
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

/**
 * Backward links applications actually store that `Intl.supportedValuesOf`
 * omits. `America/Yellowknife` stays in this list even after it gains a rule
 * of its own: that is the zone that proves the derivation above works.
 */
const backwardLinks: readonly string[] = [
  "America/Yellowknife",
  "America/Montreal",
  "US/Arizona",
  "Europe/Kiev",
  "Asia/Calcutta"
];

const enumeratedZones = Intl.supportedValuesOf("timeZone");

/** Every zone the host recognizes, outside the rule table. */
const ungovernedZones = Array.from(
  new Set([...enumeratedZones, ...backwardLinks])
).filter((timeZoneId) => !governedIds.has(timeZoneId.toLowerCase()));

/** Representative instants: an ordinary day in each half of the year, and the 2026 skipped-fall-back morning both sides read as an unrelated instant. */
const instants: readonly string[] = [
  "2026-01-15T12:00:00Z",
  "2026-06-15T12:00:00Z",
  "2026-11-01T02:00:00Z",
  "2026-11-01T09:30:00Z"
];

/** Representative wall-clock readings, including one many zones repeat or skip. */
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
  it("derives a non-empty set of zones outside the rule table", () => {
    // The rule table (3 zones and their aliases) is a small fraction of the
    // host's own zone list; a derivation that accidentally excluded
    // everything would still make every case below vacuously pass.
    expect(ungovernedZones.length).toBeGreaterThan(300);
  });

  it("keeps the named backward links, including America/Yellowknife", () => {
    for (const link of backwardLinks) {
      expect(ungovernedZones).toContain(link);
    }
  });

  describe.each(ungovernedZones)("%s", (timeZoneId) => {
    it("corrects an instant to exactly what the host returns", () => {
      for (const instant of instants) {
        const hostInstant = temporal.Instant.from(instant);
        const expectedOffset =
          hostInstant.toZonedDateTimeISO(timeZoneId).offset;

        const result = toCorrectedZonedTime({ instant, timeZoneId });

        expect(result.instant).toBe(hostInstant.toString());
        expect(result.offset).toBe(expectedOffset);
        expect(result.timeZoneId).toBe(timeZoneId);
      }
    });

    it("resolves a wall-clock reading to exactly the instant the host assigns", () => {
      for (const wallTime of wallTimes) {
        const local = temporal.PlainDateTime.from(wallTime);
        for (const disambiguation of disambiguations) {
          let expected: string | undefined;
          let expectedThrows = false;
          try {
            expected = local
              .toZonedDateTime(timeZoneId, { disambiguation })
              .toInstant()
              .toString();
          } catch {
            expectedThrows = true;
          }

          if (expectedThrows) {
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
          expect(result.instant).toBe(expected);
          expect(result.timeZoneId).toBe(timeZoneId);
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
