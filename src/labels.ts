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
 * The approved label for a governed zone at an instant, or `undefined` before
 * that rule's first divergence and for any identifier no rule governs.
 *
 * No input makes it throw, unlike the correction functions, so it can be
 * called unconditionally while formatting. A caller with no label falls back
 * to the host's own name; the package derives none from `Intl`.
 *
 * The rule table is the sole authority: a label is a fact about a statute, so
 * the host is not consulted and a governed zone is labelled whether or not
 * the host knows it.
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
