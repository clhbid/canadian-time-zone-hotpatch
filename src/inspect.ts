/**
 * Classifies whether the running host's time zone data agrees with a rule by
 * comparing offsets the host reports against the offsets the rule requires.
 *
 * Detection never sniffs user agents, operating systems, ICU, Temporal
 * implementations, or tzdata versions: an observed offset is the only signal.
 */
import { isKnownTimeZoneId, observeOffset } from "./host.js";
import { findRule, rules } from "./rules.js";
import { Temporal } from "./temporal.js";
import type { HostSupport, TimeZoneSupport } from "./types.js";

/**
 * Inspects host support for `timeZoneId`, probing at `instant` or, when it is
 * omitted, at the governing rule's own first divergence — the probe that
 * answers "does this host know the rule?" without caller bias.
 *
 * Never throws for a malformed or unrecognized zone identifier — that is an
 * `unknown` result. A malformed `instant` is a caller error and throws the
 * `RangeError` Temporal raises for it.
 */
export function inspectTimeZoneSupport(
  timeZoneId: string,
  instant?: string
): TimeZoneSupport {
  const rule = findRule(timeZoneId);
  if (!rule) {
    return Object.freeze({
      status: isKnownTimeZoneId(timeZoneId) ? "not_applicable" : "unknown",
      timeZoneId
    });
  }

  const firstDivergence = Temporal.Instant.from(rule.firstDivergenceInstant);
  const probe = instant ? Temporal.Instant.from(instant) : firstDivergence;

  const observedOffset = observeOffset(rule.canonicalTimeZoneId, probe);
  if (observedOffset === undefined) {
    // The package knows the zone but this host does not, so its support
    // cannot be classified.
    return Object.freeze({ status: "unknown", timeZoneId });
  }

  // Before first divergence a seasonal host is still correct by definition,
  // so whatever it reports is what the rule expects and no correction is due.
  const expectedOffset =
    Temporal.Instant.compare(probe, firstDivergence) < 0
      ? observedOffset
      : rule.offset;

  return Object.freeze({
    status: expectedOffset === observedOffset ? "current" : "stale",
    timeZoneId: rule.canonicalTimeZoneId,
    ruleId: rule.ruleId
  });
}

/**
 * Asks whether this host's timezone data knows the rules this package
 * patches, probing every rule at that rule's own first divergence. A host
 * that cannot observe a governed zone at all counts as stale for that rule,
 * having demonstrably not got the rule.
 */
export function inspectHostSupport(): HostSupport {
  const staleRuleIds = rules
    .filter(
      (rule) =>
        inspectTimeZoneSupport(rule.canonicalTimeZoneId).status !== "current"
    )
    .map((rule) => rule.ruleId);
  return Object.freeze({
    status: staleRuleIds.length > 0 ? "stale" : "current",
    staleRuleIds: Object.freeze(staleRuleIds)
  });
}
