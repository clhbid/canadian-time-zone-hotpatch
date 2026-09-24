/**
 * Classifies whether the running host's time zone data agrees with a rule by
 * comparing offsets the host reports against the offsets the rule requires.
 *
 * Detection never sniffs user agents, operating systems, ICU, Temporal
 * implementations, or tzdata versions: an observed offset is the only signal.
 */
import { isKnownTimeZoneId, observeOffset } from "./host.js";
import { findRule, rules } from "./rules.js";
import type { TemporalNamespace } from "./temporal.js";
import type { HostSupport, RuleSupport, TimeZoneSupport } from "./types.js";
import { TimeZoneSupportStatus } from "./types.js";

/**
 * Inspects host support for `timeZoneId`, probing at `instant` or, when it is
 * omitted, at the governing rule's own first divergence — the probe that
 * answers "does this host know the rule?" without caller bias.
 *
 * Never throws for a malformed or unrecognized zone identifier — that is an
 * `unknown` result.
 * @throws {RangeError} When `instant` is supplied and malformed. The public
 * export takes no `instant`, so nothing a caller passes it can throw.
 */
export function inspectTimeZoneSupport(
  temporal: TemporalNamespace,
  timeZoneId: string,
  instant?: string
): TimeZoneSupport {
  const rule = findRule(timeZoneId);
  if (!rule) {
    return Object.freeze({
      status: isKnownTimeZoneId(temporal, timeZoneId)
        ? TimeZoneSupportStatus.not_applicable
        : TimeZoneSupportStatus.unknown,
      timeZoneId
    } satisfies TimeZoneSupport);
  }

  const firstDivergence = temporal.Instant.from(rule.firstDivergenceInstant);
  const probe = instant ? temporal.Instant.from(instant) : firstDivergence;

  const observedOffset = observeOffset(rule.canonicalTimeZoneId, probe);
  if (observedOffset === undefined) {
    // The package knows the zone but this host does not, so its support
    // cannot be classified.
    return Object.freeze({
      status: TimeZoneSupportStatus.unknown,
      timeZoneId
    } satisfies TimeZoneSupport);
  }

  // Before first divergence a seasonal host is still correct by definition,
  // so whatever it reports is what the rule expects and no correction is due.
  const expectedOffset =
    temporal.Instant.compare(probe, firstDivergence) < 0
      ? observedOffset
      : rule.offset;

  return Object.freeze({
    status:
      expectedOffset === observedOffset
        ? TimeZoneSupportStatus.current
        : TimeZoneSupportStatus.stale,
    timeZoneId: rule.canonicalTimeZoneId,
    ruleId: rule.ruleId
  } satisfies TimeZoneSupport);
}

/**
 * Asks whether this host's timezone data knows the rules this package
 * patches, probing every rule at that rule's own first divergence. A host
 * that cannot observe a governed zone at all counts as stale for that rule,
 * since it cannot be assured to handle the zone correctly.
 */
export function inspectHostSupport(temporal: TemporalNamespace): HostSupport {
  const ruleSupport = rules.map((rule) => {
    const support = inspectTimeZoneSupport(temporal, rule.canonicalTimeZoneId);
    return Object.freeze({
      ruleId: rule.ruleId,
      status:
        support.status === TimeZoneSupportStatus.not_applicable ||
        support.status === TimeZoneSupportStatus.unknown
          ? TimeZoneSupportStatus.stale
          : support.status
    } satisfies RuleSupport);
  });
  const staleRuleIds = ruleSupport
    .filter((entry) => entry.status !== TimeZoneSupportStatus.current)
    .map((entry) => entry.ruleId);
  return Object.freeze({
    status:
      staleRuleIds.length > 0
        ? TimeZoneSupportStatus.stale
        : TimeZoneSupportStatus.current,
    staleRuleIds: Object.freeze(staleRuleIds),
    ruleSupport: Object.freeze(ruleSupport)
  } satisfies HostSupport);
}
