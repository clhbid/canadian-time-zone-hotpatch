/**
 * Classifies whether the running host's time zone data agrees with a rule by
 * comparing offsets the host reports against the offsets the rule requires.
 *
 * Detection never sniffs user agents, operating systems, ICU, Temporal
 * implementations, or tzdata versions: an observed offset is the only signal.
 */
import { isKnownTimeZoneId, observeOffset } from "./host.js";
import { findRule } from "./rules.js";
import { Temporal } from "./temporal.js";
import type { InspectTimeZoneSupportInput, TimeZoneSupport } from "./types.js";

/**
 * Inspects host support for `input.timeZoneId`.
 *
 * Never throws for a malformed or unrecognized zone identifier — that is an
 * `unknown` result. A malformed `instant` is a caller error and throws the
 * `RangeError` Temporal raises for it.
 */
export function inspectTimeZoneSupport(
  input: InspectTimeZoneSupportInput
): TimeZoneSupport {
  const rule = findRule(input.timeZoneId);
  if (!rule) {
    return Object.freeze({
      status: isKnownTimeZoneId(input.timeZoneId)
        ? "not_applicable"
        : "unknown",
      timeZoneId: input.timeZoneId
    });
  }

  const firstDivergence = Temporal.Instant.from(rule.firstDivergenceInstant);
  const probe = input.instant
    ? Temporal.Instant.from(input.instant)
    : firstDivergence;

  const observedOffset = observeOffset(rule.canonicalTimeZoneId, probe);
  if (observedOffset === undefined) {
    // The package knows the zone but this host does not, so its support
    // cannot be classified.
    return Object.freeze({
      status: "unknown",
      timeZoneId: rule.canonicalTimeZoneId
    });
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
    ruleId: rule.ruleId,
    expectedOffset,
    observedOffset,
    firstDivergence: rule.firstDivergenceInstant
  });
}
