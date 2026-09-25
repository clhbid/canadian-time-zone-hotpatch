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

/**
 * A rule's verdict, from `firstDivergenceInstant` onwards: whether the host
 * never adopted the rule's offset (`stale`), adopted it and reports nothing
 * later (`current`), or adopted it and reports a later offset transition the
 * rule table does not know about (`rule_outdated`). The verdict is decided
 * once per rule and applies to every instant from first divergence onwards,
 * including a seasonal host's daylight-period instants.
 */
function ruleVerdict(
  rule: TimeZoneRule,
  firstDivergence: HostInstant,
  offsetAtDivergence: string | undefined
): Exclude<TimeZoneSupportStatus, "not_applicable" | "unknown"> {
  if (offsetAtDivergence !== rule.offset) {
    // The host never reported the rule's offset at first divergence, so it
    // never adopted the rule: nothing here proves it knows of a revision.
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
  if (temporal.Instant.compare(probe, firstDivergence) < 0) {
    return Object.freeze({
      status: TimeZoneSupportStatus.current,
      timeZoneId: rule.canonicalTimeZoneId,
      ruleId: rule.ruleId
    } satisfies TimeZoneSupport);
  }

  // The verdict belongs to the rule, not the probed instant: both host reads
  // it decides on are taken at first divergence, whether or not that is where
  // `probe` itself falls.
  const offsetAtDivergence =
    temporal.Instant.compare(probe, firstDivergence) === 0
      ? observedOffset
      : observeOffset(rule.canonicalTimeZoneId, firstDivergence);

  return Object.freeze({
    status: ruleVerdict(rule, firstDivergence, offsetAtDivergence),
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
  // `stale` wins over `rule_outdated` because correction still applies to a
  // stale rule; `rule_outdated` wins over `current` because it still needs
  // attention. Alert on `ruleSupport`, not this summary, to catch an
  // outdated rule hidden behind a stale one.
  const status = ruleSupport.some(
    (entry) => entry.status === TimeZoneSupportStatus.stale
  )
    ? TimeZoneSupportStatus.stale
    : ruleSupport.some(
          (entry) => entry.status === TimeZoneSupportStatus.rule_outdated
        )
      ? TimeZoneSupportStatus.rule_outdated
      : TimeZoneSupportStatus.current;
  return Object.freeze({
    status,
    ruleSupport: Object.freeze(ruleSupport)
  } satisfies HostSupport);
}
