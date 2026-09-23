/**
 * Approved English labels for each rule, and the lookup that decides when one
 * applies.
 *
 * Labels cannot alter offset rules, which are owned exclusively
 * by `src/rules.ts`.
 */
import { isKnownTimeZoneId } from "./host.js";
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
 * there is none: before that rule's first divergence, for a zone no rule
 * governs — including the rules' own fixed `Etc/GMT` correction zones, which
 * are ordinary zones and name no jurisdiction — and for an identifier neither
 * the package nor the host recognizes.
 *
 * Unlike the correction functions, this never throws, so it can be called
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
  if (!rule || !isKnownTimeZoneId(temporal, rule.canonicalTimeZoneId)) {
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
