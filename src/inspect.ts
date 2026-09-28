/**
 * Classifies whether the running host's time zone data agrees with a rule by
 * comparing offsets the host reports against the offsets the rule requires.
 *
 * Detection never sniffs user agents, operating systems, ICU, Temporal
 * implementations, or tzdata versions: an observed offset is the only signal.
 */
import type { HostInstant } from "./host.js";
import {
  isKnownTimeZoneId,
  observeNextTransition,
  observeOffset
} from "./host.js";
import { findRule, rules, type TimeZoneRule } from "./rules.js";
import type { TemporalNamespace } from "./temporal.js";
import type { HostSupport, RuleSupport, TimeZoneSupport } from "./types.js";
import { TimeZoneSupportStatus } from "./types.js";

type GovernedStatus = Exclude<
  TimeZoneSupportStatus,
  "not_applicable" | "unknown"
>;

/**
 * A rule's verdict at first divergence.
 * @param rule - The rule to verdict.
 * @param firstDivergence - The rule's first divergence instant.
 * @param offsetAtDivergence - The host's offset there, or `undefined` if unobservable.
 * @returns `stale` if the host never reported the rule's offset there,
 * `rule_outdated` if it did and later reports a further offset transition,
 * else `current`.
 */
function ruleVerdictAtDivergence(
  rule: TimeZoneRule,
  firstDivergence: HostInstant,
  offsetAtDivergence: string | undefined
): GovernedStatus {
  if (offsetAtDivergence !== rule.offset) {
    return TimeZoneSupportStatus.stale;
  }
  const revision = observeNextTransition(
    rule.canonicalTimeZoneId,
    firstDivergence
  );
  return revision !== undefined
    ? TimeZoneSupportStatus.rule_outdated
    : TimeZoneSupportStatus.current;
}

/** Builds a frozen `TimeZoneSupport` for an ungoverned or unrecognized zone. */
function ungovernedSupport(
  status: "not_applicable" | "unknown",
  timeZoneId: string
): TimeZoneSupport {
  return Object.freeze({ status, timeZoneId } satisfies TimeZoneSupport);
}

/** Builds a frozen `TimeZoneSupport` for a zone `rule` governs. */
function governedSupport(
  status: GovernedStatus,
  rule: TimeZoneRule
): TimeZoneSupport {
  return Object.freeze({
    status,
    timeZoneId: rule.canonicalTimeZoneId,
    ruleId: rule.ruleId
  } satisfies TimeZoneSupport);
}

/**
 * Inspects host support for `timeZoneId`, probing at `instant` or, when it is
 * omitted, at the governing rule's own first divergence.
 *
 * Never throws for a malformed or unrecognized zone identifier — that is an
 * `unknown` result.
 * @param temporal - Temporal namespace to probe with.
 * @param timeZoneId - IANA time zone identifier, matched case-insensitively; aliases are accepted.
 * @param instant - ISO 8601 instant to probe at; defaults to the rule's first divergence.
 * @returns The zone's support.
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
    return ungovernedSupport(
      isKnownTimeZoneId(temporal, timeZoneId)
        ? TimeZoneSupportStatus.not_applicable
        : TimeZoneSupportStatus.unknown,
      timeZoneId
    );
  }

  const firstDivergence = temporal.Instant.from(rule.firstDivergenceInstant);
  const probe = instant ? temporal.Instant.from(instant) : firstDivergence;

  const observedOffset = observeOffset(rule.canonicalTimeZoneId, probe);
  if (observedOffset === undefined) {
    return ungovernedSupport(TimeZoneSupportStatus.unknown, timeZoneId);
  }

  if (temporal.Instant.compare(probe, firstDivergence) < 0) {
    return governedSupport(TimeZoneSupportStatus.current, rule);
  }

  const offsetAtDivergence =
    temporal.Instant.compare(probe, firstDivergence) === 0
      ? observedOffset
      : observeOffset(rule.canonicalTimeZoneId, firstDivergence);

  return governedSupport(
    ruleVerdictAtDivergence(rule, firstDivergence, offsetAtDivergence),
    rule
  );
}

/**
 * Asks whether this host's timezone data knows the rules this package
 * patches, probing every rule at that rule's own first divergence.
 * @param temporal - Temporal namespace to probe with.
 * @returns Every rule's status on this host, in rule-table order.
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
  return Object.freeze({
    ruleSupport: Object.freeze(ruleSupport)
  } satisfies HostSupport);
}
