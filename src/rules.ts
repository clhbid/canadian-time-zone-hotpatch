/**
 * Source-cited rule table for Canadian permanent-time changes.
 *
 * Each rule models a jurisdiction that has legislated a permanent, year-round
 * UTC offset (ending seasonal clock changes), together with the first instant
 * a legacy (un-patched) host's seasonal time zone data would diverge from the
 * legislated offset.
 *
 * `legalEffectiveInstant` and `firstDivergenceInstant` are modeled separately:
 * the former is the instant the legislated offset legally commences (comes
 * into force — not the date of Royal Assent or a government announcement),
 * the latter is the first wall-clock moment a seasonal transition is skipped
 * (typically the next scheduled "fall back"). The two coincide where the
 * legislation commences at that skipped transition.
 */
import type { TimeZoneRule } from "./types.js";

export const rules: readonly TimeZoneRule[] = Object.freeze([
  Object.freeze({
    ruleId: "ab-permanent-time-2026",
    canonicalTimeZoneId: "America/Edmonton",
    aliases: Object.freeze(["Canada/Mountain"]),
    jurisdiction: "Alberta",
    offset: "-06:00",
    fixedTimeZoneId: "Etc/GMT+6",
    // Order in Council 204/2026 proclaimed the Official Time Act in force on
    // June 18. The Act fixes official time at UTC-6.
    legalEffectiveInstant: "2026-06-18T00:00:00-06:00",
    // The next scheduled "fall back" is skipped; clocks stay at -06:00.
    firstDivergenceInstant: "2026-11-01T02:00:00-06:00",
    citations: Object.freeze([
      Object.freeze({
        title: "Order in Council 204/2026",
        url: "https://kings-printer.alberta.ca/Documents/Orders/Orders_in_Council/2026/2026_204.html"
      }),
      Object.freeze({
        title: "Official Time Act",
        url: "https://www.canlii.org/en/ab/laws/stat/rsa-2000-c-o-5.7/latest/rsa-2000-c-o-5.7.html"
      }),
      Object.freeze({
        title: "Alberta Is Set to Adopt Permanent Daylight Saving Time",
        url: "https://www.timeanddate.com/news/time/alberta-permanent-dst.html"
      }),
      Object.freeze({
        title: "Alberta Time Is Official: Bill 31 Ends Clock Changes",
        url: "https://www.culturealberta.com/articles/alberta-time-is-official-bill-31-ends-clock-changes-for-good-in-alberta"
      })
    ])
  }),
  Object.freeze({
    ruleId: "bc-permanent-time-2026",
    canonicalTimeZoneId: "America/Vancouver",
    aliases: Object.freeze(["Canada/Pacific"]),
    jurisdiction: "British Columbia",
    offset: "-07:00",
    fixedTimeZoneId: "Etc/GMT+7",
    // Order in Council 63/2026 brings the Interpretation Amendment Act into
    // force at the start of March 9, 2026 in B.C.'s new UTC-7 Pacific time.
    legalEffectiveInstant: "2026-03-09T00:00:00-07:00",
    // The next scheduled "fall back" is skipped; clocks stay at -07:00.
    firstDivergenceInstant: "2026-11-01T02:00:00-07:00",
    citations: Object.freeze([
      Object.freeze({
        title: "Order in Council No. 63/2026",
        url: "https://www.bclaws.gov.bc.ca/civix/document/id/oic/oic_cur/0063_2026"
      }),
      Object.freeze({
        title: "British Columbia (BC) Adopts Permanent Daylight Saving Time",
        url: "https://www.timeanddate.com/news/time/canada-bc-permanent-dst.html"
      }),
      Object.freeze({
        title: "Permanent daylight saving time — Province of British Columbia",
        url: "https://www2.gov.bc.ca/gov/content/governments/celebrating-british-columbia/daylight-saving-time"
      })
    ])
  }),
  Object.freeze({
    ruleId: "mb-permanent-time-2026",
    canonicalTimeZoneId: "America/Winnipeg",
    aliases: Object.freeze(["Canada/Central"]),
    jurisdiction: "Manitoba",
    offset: "-05:00",
    fixedTimeZoneId: "Etc/GMT+5",
    // Bill 223 commences at the start of March 8, 2026; legacy host data does
    // not permanently diverge until the later skipped "fall back".
    legalEffectiveInstant: "2026-03-08T00:00:00-06:00",
    // The next scheduled "fall back" is skipped; clocks stay at -05:00.
    firstDivergenceInstant: "2026-11-01T02:00:00-05:00",
    citations: Object.freeze([
      Object.freeze({
        title: "The Official Time Amendment Act, 2025 (Bill 223)",
        url: "https://web2.gov.mb.ca/bills/43-2/b223e.php"
      }),
      Object.freeze({
        title: "Manitoba Will Move to Permanent Daylight Time",
        url: "https://news.gov.mb.ca/news/?item=75397"
      })
    ])
  })
]) as readonly TimeZoneRule[];

/** Builds a lookup from every canonical id and alias to its owning rule. */
function buildRuleIndex(): ReadonlyMap<string, TimeZoneRule> {
  const index = new Map<string, TimeZoneRule>();
  for (const rule of rules) {
    index.set(normalizeLookupKey(rule.canonicalTimeZoneId), rule);
    for (const alias of rule.aliases) {
      index.set(normalizeLookupKey(alias), rule);
    }
  }
  return index;
}

const ruleIndex = buildRuleIndex();

/** Looks up the rule governing `timeZoneId` (canonical id or known alias). */
export function findRule(timeZoneId: string): TimeZoneRule | undefined {
  return ruleIndex.get(normalizeLookupKey(timeZoneId));
}

/** Normalizes a known alias to its canonical time zone identifier. */
export function normalizeTimeZoneId(timeZoneId: string): string {
  const rule = findRule(timeZoneId);
  return rule ? rule.canonicalTimeZoneId : timeZoneId;
}

function normalizeLookupKey(timeZoneId: string): string {
  return timeZoneId.toLowerCase();
}
