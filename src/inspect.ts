/**
 * Detects whether the host's own time zone data agrees with a rule, by
 * comparing observed offsets — never by user-agent or version sniffing.
 */
import { Temporal } from "./temporal.js";
import { isKnownTimeZoneId, observeOffset } from "./host.js";
import type { InspectTimeZoneSupportInput, TimeZoneSupport } from "./types.js";
import { findRule, normalizeTimeZoneId } from "./rules.js";

export function inspectTimeZoneSupport(input: InspectTimeZoneSupportInput): TimeZoneSupport {
  const rule = findRule(input.timeZoneId);
  const normalizedId = normalizeTimeZoneId(input.timeZoneId);

  if (!rule) {
    if (!isKnownTimeZoneId(input.timeZoneId)) {
      return Object.freeze({ status: "unknown", timeZoneId: input.timeZoneId });
    }
    return Object.freeze({ status: "not_applicable", timeZoneId: normalizedId });
  }

  // Probe at (or after) the first instant the rule and a legacy host would
  // diverge, so callers omitting `instant` get a stable, unbiased signal.
  const probeInstant = input.instant
    ? Temporal.Instant.from(input.instant)
    : Temporal.Instant.from(rule.firstDivergenceInstant);

  const divergenceInstant = Temporal.Instant.from(rule.firstDivergenceInstant);
  const isAtOrAfterDivergence = Temporal.Instant.compare(probeInstant, divergenceInstant) >= 0;

  const observedOffset = observeOffset(rule.canonicalTimeZoneId, probeInstant);
  if (observedOffset === undefined) {
    return Object.freeze({ status: "unknown", timeZoneId: normalizedId });
  }

  const expectedOffset = isAtOrAfterDivergence ? rule.offset : observedOffset;
  const status = expectedOffset === observedOffset ? "current" : "stale";

  return Object.freeze({
    status,
    timeZoneId: normalizedId,
    ruleId: rule.ruleId,
    ruleVersion: rule.ruleVersion,
    expectedOffset,
    observedOffset,
    firstDivergence: rule.firstDivergenceInstant,
  });
}
