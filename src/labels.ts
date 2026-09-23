/**
 * Approved English labels for each rule, and the lookup that decides when one
 * applies.
 *
 * Labels cannot alter offset rules, which are owned exclusively
 * by `src/rules.ts`.
 */
import { findRule } from "./rules.js";
import type { TemporalNamespace } from "./temporal.js";
import type { RuleId, TimeZoneLabel, ToTimeZoneLabelInput } from "./types.js";

export const labels: Readonly<Record<RuleId, TimeZoneLabel>> = Object.freeze({
  "ab-permanent-time-2026": Object.freeze({
    long: "Alberta Time",
    short: "ABT"
  }),
  "bc-permanent-time-2026": Object.freeze({
    long: "Pacific Time",
    short: "PCT"
  }),
  "mb-permanent-time-2026": Object.freeze({
    long: "Manitoba Standard Time",
    short: "MBT"
  })
});

/**
 * The approved label for a governed zone at an instant, or `undefined` when
 * there is none: before that rule's first divergence, and for any identifier
 * no rule governs — an ordinary zone, a malformed string, and the rules' own
 * fixed `Etc/GMT` correction zones, which are legitimate zones in their own
 * right and name no jurisdiction.
 *
 * The rule table is the sole authority here, and the host is not consulted at
 * all. An approved label is a fact about a jurisdiction's statute, true on a
 * host that has never heard of the zone — indeed most true there, since such
 * a host is the reason this package exists. Whether the host can *format* the
 * zone is the correction functions' question, and they throw when it cannot.
 *
 * Unlike those functions, this never throws, so it can be called
 * unconditionally from a formatting path. A caller with no label falls back
 * to the host's own name for the zone; the package derives none from `Intl`.
 *
 * The comparison is at instant granularity. A wall time of 01:30 on the
 * divergence morning resolves to an instant before the boundary, so it gets
 * no label even where the offset has already been corrected — at 01:30 the
 * clock genuinely is still on seasonal time.
 */
export function toTimeZoneLabel(
  temporal: TemporalNamespace,
  input: ToTimeZoneLabelInput
): TimeZoneLabel | undefined {
  const rule = findRule(input.timeZoneId);
  if (!rule) {
    return undefined;
  }
  try {
    const instant = temporal.Instant.from(input.instant);
    const firstDivergence = temporal.Instant.from(rule.firstDivergenceInstant);
    return temporal.Instant.compare(instant, firstDivergence) < 0
      ? undefined
      : labels[rule.ruleId];
  } catch {
    // A malformed instant is unlabelled rather than fatal: this lookup is
    // called in formatting paths that must not fail.
    return undefined;
  }
}
