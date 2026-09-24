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
import type { RuleId } from "./types.js";

/** A correction rule for a Canadian time zone moving to a permanent UTC offset. */
export interface TimeZoneRule {
  /** Stable identifier for this rule. */
  readonly ruleId: RuleId;
  /** Canonical IANA time zone identifier this rule governs. */
  readonly canonicalTimeZoneId: string;
  /** Recognized IANA aliases/links that normalize to `canonicalTimeZoneId`. */
  readonly aliases: readonly string[];
  /** Human-readable jurisdiction name (for diagnostics, not for display). */
  readonly jurisdiction: string;
  /** Permanent UTC offset mandated by the rule, e.g. `"-06:00"`. */
  readonly offset: string;
  /** Fixed-offset `Etc/GMT` zone equivalent to `offset`, used for correction. */
  readonly fixedTimeZoneId: string;
  /** Instant the legislated offset legally commences, when it has been enacted. */
  readonly legalEffectiveInstant?: string;
  /** First instant a legacy (seasonal) host and the rule disagree. */
  readonly firstDivergenceInstant: string;
}

export const rules: readonly TimeZoneRule[] = Object.freeze([
  Object.freeze({
    ruleId: "ab-permanent-time-2026",
    canonicalTimeZoneId: "America/Edmonton",
    aliases: Object.freeze(["Canada/Mountain"]),
    jurisdiction: "Alberta",
    offset: "-06:00",
    fixedTimeZoneId: "Etc/GMT+6",
    // Order in Council 204/2026 proclaimed the Official Time Act in force on June 18.
    // Sources:
    // - https://kings-printer.alberta.ca/Documents/Orders/Orders_in_Council/2026/2026_204.html
    // - https://www.canlii.org/en/ab/laws/stat/rsa-2000-c-o-5.7/latest/rsa-2000-c-o-5.7.html
    legalEffectiveInstant: "2026-06-18T00:00:00-06:00",
    // Label "Alberta Time" / "ABT": the province states ABT is the official
    // abbreviation.
    // Source: https://www.alberta.ca/albertas-new-time-system-abt
    // The next scheduled "fall back" is skipped; clocks stay at -06:00.
    firstDivergenceInstant: "2026-11-01T02:00:00-06:00"
  }),
  Object.freeze({
    ruleId: "bc-permanent-time-2026",
    canonicalTimeZoneId: "America/Vancouver",
    aliases: Object.freeze(["Canada/Pacific"]),
    jurisdiction: "British Columbia",
    offset: "-07:00",
    fixedTimeZoneId: "Etc/GMT+7",
    // Order in Council 63/2026 brings the Interpretation Amendment Act into force
    // at the start of March 9, 2026 in B.C.'s new UTC-7 Pacific time.
    // Source: https://www.bclaws.gov.bc.ca/civix/document/id/oic/oic_cur/0063_2026
    legalEffectiveInstant: "2026-03-09T00:00:00-07:00",
    // Label "Pacific Time" / "PCT": the province names the code PCT, replacing
    // PST and PDT. The Order in Council above establishes the offset, not the name.
    // Source: https://news.gov.bc.ca/releases/2026CITZ0009-001073
    // The next scheduled "fall back" is skipped; clocks stay at -07:00.
    firstDivergenceInstant: "2026-11-01T02:00:00-07:00"
  }),
  Object.freeze({
    ruleId: "mb-permanent-time-2026",
    canonicalTimeZoneId: "America/Winnipeg",
    aliases: Object.freeze(["Canada/Central"]),
    jurisdiction: "Manitoba",
    offset: "-05:00",
    fixedTimeZoneId: "Etc/GMT+5",
    // Manitoba announced that the next scheduled "fall back" will be skipped,
    // but has not yet proclaimed a legal commencement, so `legalEffectiveInstant`
    // is deliberately left unset: The Official Time Amendment Act, S.M. 2023, c. 4
    // is not in force. Its s. 4 commences it on a day fixed by proclamation and no
    // proclamation has been made; two private members' bills would fix a date —
    // Bill 223 (43-2) at March 8, 2026 and Bill 214 (43-3) at March 14, 2027 —
    // and neither has royal assent. The change proceeds by the government
    // announcement of 2026-09-17 instead.
    // Label "Manitoba Standard Time" / "MBT": s. 1 of that Act defines Manitoba
    // Standard Time as five hours behind UTC and s. 2(1.1) states the official
    // time may be referred to as MBT.
    // Sources:
    // - https://web2.gov.mb.ca/laws/statutes/2023/c00423.php?lang=en
    // - https://news.gov.mb.ca/news/?item=75397
    firstDivergenceInstant: "2026-11-01T02:00:00-05:00"
  }),
  Object.freeze({
    ruleId: "nt-yellowknife-permanent-time-2026",
    canonicalTimeZoneId: "America/Yellowknife",
    aliases: Object.freeze([]),
    jurisdiction: "Northwest Territories",
    offset: "-06:00",
    fixedTimeZoneId: "Etc/GMT+6",
    // The regulations establishing Northwest Territories Time came into force
    // on August 21, 2026. They carry no registration number, so the
    // announcement is the citable source. It gives no short code, so this
    // rule bundles no label.
    // Source: https://www.gov.nt.ca/en/newsroom/northwest-territories-ends-seasonal-time-change
    legalEffectiveInstant: "2026-08-21T00:00:00-06:00",
    firstDivergenceInstant: "2026-11-01T02:00:00-06:00"
  }),
  Object.freeze({
    ruleId: "nt-inuvik-permanent-time-2026",
    canonicalTimeZoneId: "America/Inuvik",
    aliases: Object.freeze([]),
    jurisdiction: "Northwest Territories",
    offset: "-06:00",
    fixedTimeZoneId: "Etc/GMT+6",
    // Same regulations as Yellowknife, under a rule of its own: Inuvik needs
    // its own upstream tzdata fix, so the two zones go current at different
    // times and `inspectHostSupport` reports them separately.
    // Source: https://www.gov.nt.ca/en/newsroom/northwest-territories-ends-seasonal-time-change
    legalEffectiveInstant: "2026-08-21T00:00:00-06:00",
    firstDivergenceInstant: "2026-11-01T02:00:00-06:00"
  })
]);

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
