/*
 * The boundary matrix for approved labels lives here alone: the correction
 * specs assert offsets and zones, not names.
 *
 * The whole suite runs against a host that recognizes no time zone, so every
 * case below also pins that labelling reads only the rule table and the
 * supplied Temporal. Make it consult the host and this file fails wholesale.
 */
import { describe, expect, it, vi } from "vitest";
import { labels } from "../src/labels.js";
import { rules } from "../src/rules.js";
import { hotpatch } from "./fixtures/temporal.js";

vi.mock("../src/host.js", () => ({
  isKnownTimeZoneId: () => false,
  observeOffset: () => undefined,
  observeInstant: () => {
    throw new RangeError("This host recognizes no time zone identifiers.");
  }
}));

const { toTimeZoneLabel } = hotpatch;

/** `rule.firstDivergenceInstant` shifted by `deltaMilliseconds`, in UTC form. */
function around(divergenceInstant: string, deltaMilliseconds: number): string {
  return new Date(Date.parse(divergenceInstant) + deltaMilliseconds)
    .toISOString()
    .replace(".000Z", "Z");
}

const cases = rules.map((rule) => [rule.canonicalTimeZoneId, rule] as const);

// The boundary matrix reads its expected label from `labels`, so an
// unlabelled rule would collapse it to `undefined` equals `undefined`. Those
// rules are pinned explicitly instead, below.
const labelledCases = cases.filter(([, rule]) => labels[rule.ruleId]);
const unlabelledCases = cases.filter(([, rule]) => !labels[rule.ruleId]);

describe("toTimeZoneLabel", () => {
  it.each(labelledCases)(
    "labels %s from its first divergence onwards",
    (_, rule) => {
      const label = labels[rule.ruleId];
      expect(
        toTimeZoneLabel({
          instant: around(rule.firstDivergenceInstant, -1000),
          timeZoneId: rule.canonicalTimeZoneId
        })
      ).toBeUndefined();
      for (const delta of [0, 1000]) {
        expect(
          toTimeZoneLabel({
            instant: around(rule.firstDivergenceInstant, delta),
            timeZoneId: rule.canonicalTimeZoneId
          })
        ).toEqual(label);
      }
    }
  );

  it.each(cases)("gives %s no label at a historical instant", (timeZoneId) => {
    expect(
      toTimeZoneLabel({ instant: "2019-07-01T12:00:00Z", timeZoneId })
    ).toBeUndefined();
  });

  it.each(labelledCases)(
    "accepts %s's aliases, case-insensitively",
    (_, rule) => {
      const instant = around(rule.firstDivergenceInstant, 0);
      for (const alias of rule.aliases) {
        expect(toTimeZoneLabel({ instant, timeZoneId: alias })).toEqual(
          labels[rule.ruleId]
        );
        expect(
          toTimeZoneLabel({ instant, timeZoneId: alias.toUpperCase() })
        ).toEqual(labels[rule.ruleId]);
      }
    }
  );

  it.each(cases)("does not label %s's fixed correction zone", (_, rule) => {
    expect(
      toTimeZoneLabel({
        instant: "2026-12-25T12:00:00Z",
        timeZoneId: rule.fixedTimeZoneId
      })
    ).toBeUndefined();
  });

  it.each(unlabelledCases)(
    "gives %s no label around its first divergence",
    (_, rule) => {
      for (const delta of [-1000, 0, 1000]) {
        expect(
          toTimeZoneLabel({
            instant: around(rule.firstDivergenceInstant, delta),
            timeZoneId: rule.canonicalTimeZoneId
          })
        ).toBeUndefined();
      }
    }
  );

  // Guards the split above: were a label bundled, the matrix would silently
  // stop covering the boundary it was restricted for.
  it("leaves exactly the Northwest Territories rules unlabelled", () => {
    expect(unlabelledCases.map(([timeZoneId]) => timeZoneId)).toEqual([
      "America/Yellowknife",
      "America/Inuvik"
    ]);
  });

  // The boundary matrix above reads its expected label from `labels`, so it
  // pins when a label applies, not what it says. The table itself is pinned
  // here, against its published sources.
  it("bundles the approved label for every labelled rule, and none besides", () => {
    expect(labels).toEqual({
      "ab-permanent-time-2026": { long: "Alberta Time", short: "ABT" },
      "bc-permanent-time-2026": { long: "Pacific Time", short: "PCT" },
      "mb-permanent-time-2026": { long: "Manitoba Standard Time", short: "MBT" }
    });
    expect(labels["nt-yellowknife-permanent-time-2026"]).toBeUndefined();
    expect(labels["nt-inuvik-permanent-time-2026"]).toBeUndefined();
  });

  it.each(["America/Toronto", "America/Dawson_Creek", "UTC"])(
    "returns no label for the ungoverned zone %s",
    (timeZoneId) => {
      expect(
        toTimeZoneLabel({ instant: "2026-12-25T12:00:00Z", timeZoneId })
      ).toBeUndefined();
    }
  );

  it.each(["Not/AZone", "", "not-a-zone"])(
    "returns no label for the unrecognized identifier %s rather than throwing",
    (timeZoneId) => {
      expect(
        toTimeZoneLabel({ instant: "2026-12-25T12:00:00Z", timeZoneId })
      ).toBeUndefined();
    }
  );

  it.each(["not-an-instant", "2026-12-25T12:00:00", ""])(
    "returns no label for the malformed instant %s rather than throwing",
    (instant) => {
      expect(
        toTimeZoneLabel({ instant, timeZoneId: "America/Edmonton" })
      ).toBeUndefined();
    }
  );
});
