/**
 * Classifies whether the running host's time zone data agrees with a rule by
 * comparing offsets the host reports against the offsets the rule requires.
 *
 * Detection never sniffs user agents, operating systems, ICU, Temporal
 * implementations, or tzdata versions: an observed offset is the only signal.
 */
import type { HostInstant } from "./host.js";
import {
  hostDataKey,
  isKnownTimeZoneId,
  observeNextTransition,
  observeOffset
} from "./host.js";
import { findRule, rules, type TimeZoneRule } from "./rules.js";
import type { TemporalNamespace } from "./temporal.js";
import type {
  HostSupport,
  RuleId,
  RuleSupport,
  TimeZoneSupport
} from "./types.js";
import { TimeZoneSupportStatus } from "./types.js";

type GovernedStatus = Exclude<
  TimeZoneSupportStatus,
  "not_applicable" | "unknown"
>;

/**
 * A rule's verdict at first divergence.
 * @param rule - The rule to verdict.
 * @param firstDivergence - The rule's first divergence instant.
 * @param offsetAtDivergence - The host's offset there.
 * @returns `stale` if the host never reported the rule's offset there,
 * `rule_outdated` if it did and later reports a further offset transition,
 * else `current`.
 */
function ruleVerdictAtDivergence(
  rule: TimeZoneRule,
  firstDivergence: HostInstant,
  offsetAtDivergence: string
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

type HostVerdict = GovernedStatus | "unknown";

/** Each rule's `HostVerdict`, per host data; see `hostVerdict`. */
const verdicts = new WeakMap<object, Map<RuleId, HostVerdict>>();

/**
 * The host's verdict on `rule`: `unknown` when it cannot observe the zone,
 * else the verdict at first divergence. That verdict does not depend on the
 * instant probed and costs a transition search, so it is observed once per
 * host data and cached.
 */
function hostVerdict(
  temporal: TemporalNamespace,
  rule: TimeZoneRule
): HostVerdict {
  const key = hostDataKey(temporal);
  let byRule = verdicts.get(key);
  if (byRule === undefined) {
    byRule = new Map();
    verdicts.set(key, byRule);
  }
  let verdict = byRule.get(rule.ruleId);
  if (verdict === undefined) {
    const firstDivergence = temporal.Instant.from(rule.firstDivergenceInstant);
    const offset = observeOffset(rule.canonicalTimeZoneId, firstDivergence);
    verdict =
      offset === undefined
        ? TimeZoneSupportStatus.unknown
        : ruleVerdictAtDivergence(rule, firstDivergence, offset);
    byRule.set(rule.ruleId, verdict);
  }
  return verdict;
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

  const verdict = hostVerdict(temporal, rule);
  if (verdict === TimeZoneSupportStatus.unknown) {
    return ungovernedSupport(TimeZoneSupportStatus.unknown, timeZoneId);
  }

  if (
    instant &&
    temporal.Instant.compare(
      temporal.Instant.from(instant),
      temporal.Instant.from(rule.firstDivergenceInstant)
    ) < 0
  ) {
    return governedSupport(TimeZoneSupportStatus.current, rule);
  }
  return governedSupport(verdict, rule);
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
