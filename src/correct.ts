/**
 * Corrected calculations in both directions: an instant to the offset and
 * label it should display with, and a wall-clock time to the instant it
 * denotes. Both directions decide on the same inspection logic: a current
 * host keeps the canonical named zone, a stale host uses the rule's fixed
 * `Etc/GMT` zone, an ungoverned zone passes through to host Temporal, and an
 * unknown zone fails rather than guessing a jurisdiction.
 */
import type { HostInstant, HostPlainDateTime } from "./host.js";
import { observeInstant, observeOffset } from "./host.js";
import { inspectTimeZoneSupport } from "./inspect.js";
import { labels } from "./labels.js";
import type { TimeZoneRule } from "./rules.js";
import { findRule } from "./rules.js";
import type { TemporalNamespace } from "./temporal.js";
import type {
  CorrectedZonedTime,
  TimeZoneSupport,
  ToCorrectedInstantInput,
  ToCorrectedZonedTimeInput
} from "./types.js";

/** Thrown when correction is asked for a zone the host does not recognize. */
export class UnknownTimeZoneError extends RangeError {
  constructor(timeZoneId: string) {
    super(`Cannot resolve unknown time zone identifier: "${timeZoneId}"`);
    this.name = "UnknownTimeZoneError";
  }
}

/** Thrown when a wall-clock date-time carries a UTC offset or `Z` designator. */
export class OffsetBearingWallTimeError extends RangeError {
  constructor(wallTime: string) {
    super(
      `Wall-clock time must not carry a UTC offset or "Z": "${wallTime}". ` +
        "Use toCorrectedZonedTime to display an instant."
    );
    this.name = "OffsetBearingWallTimeError";
  }
}

/** A UTC offset or `Z` at the end of a string. */
const offsetSuffix = /(?:[Zz]|[+-]\d{2}(?::?\d{2})?)$/;

/** Whether `wallTime` closes its time part with a UTC offset or `Z`, ahead of any bracketed annotation. */
function carriesOffsetDesignator(wallTime: string): boolean {
  const annotation = wallTime.indexOf("[");
  const timePart = annotation === -1 ? wallTime : wallTime.slice(0, annotation);
  const separator = timePart.search(/[Tt ]/);
  return separator !== -1 && offsetSuffix.test(timePart.slice(separator + 1));
}

/**
 * Corrects an instant for display; the instant itself never changes. Throws
 * `UnknownTimeZoneError` for a zone the host does not recognize and
 * Temporal's `RangeError` for a malformed instant.
 */
export function toCorrectedZonedTime(
  temporal: TemporalNamespace,
  input: ToCorrectedZonedTimeInput
): CorrectedZonedTime {
  const support = inspectTimeZoneSupport(
    temporal,
    input.timeZoneId,
    input.instant
  );
  if (support.status === "unknown") {
    throw new UnknownTimeZoneError(input.timeZoneId);
  }
  const rule = findRule(support.timeZoneId);
  return toCorrected(
    temporal.Instant.from(input.instant),
    effectiveTimeZoneId(support, rule),
    support
  );
}

/**
 * Computes the instant a wall-clock reading denotes. Throws
 * `OffsetBearingWallTimeError` when the input carries a UTC offset or `Z`,
 * `UnknownTimeZoneError` for a zone the host does not recognize, and
 * Temporal's `RangeError` for a malformed wall time or, under `reject`, a
 * repeated or skipped one.
 */
export function toCorrectedInstant(
  temporal: TemporalNamespace,
  input: ToCorrectedInstantInput
): CorrectedZonedTime {
  // `Temporal.PlainDateTime.from` discards a numeric offset silently, even an
  // invalid one, which would quietly reinterpret a supplied instant as wall
  // time.
  if (carriesOffsetDesignator(input.wallTime)) {
    throw new OffsetBearingWallTimeError(input.wallTime);
  }
  const local = temporal.PlainDateTime.from(input.wallTime);

  const probe = inspectTimeZoneSupport(temporal, input.timeZoneId);
  if (probe.status === "unknown") {
    throw new UnknownTimeZoneError(input.timeZoneId);
  }

  // A stale host repeats the divergence day's skipped hour and mis-offsets
  // every wall time after it, so from that calendar day on the rule-owned
  // probe decides the zone. Before it, seasonal host data is correct and
  // the host's own disambiguation applies.
  const rule = findRule(probe.timeZoneId);
  const probeDecides =
    rule !== undefined && !isBeforeDivergenceDate(temporal, rule, local);
  const timeZoneId = probeDecides
    ? effectiveTimeZoneId(probe, rule)
    : probe.timeZoneId;

  const instant = observeInstant(timeZoneId, local, input.disambiguation);
  const support = probeDecides
    ? probe
    : inspectTimeZoneSupport(temporal, probe.timeZoneId, instant.toString());
  return toCorrected(instant, timeZoneId, support);
}

/** The zone that computes correct offsets: the rule's fixed zone on a stale host, else the zone itself. */
function effectiveTimeZoneId(
  support: TimeZoneSupport,
  rule: TimeZoneRule | undefined
): string {
  return support.status === "stale" && rule
    ? rule.fixedTimeZoneId
    : support.timeZoneId;
}

function isBeforeDivergenceDate(
  temporal: TemporalNamespace,
  rule: TimeZoneRule,
  local: HostPlainDateTime
): boolean {
  // The rule's instant is written in local time, so its wall date needs no
  // host zone data.
  const divergenceDate = temporal.PlainDate.from(rule.firstDivergenceInstant);
  return temporal.PlainDate.compare(local.toPlainDate(), divergenceDate) < 0;
}

function toCorrected(
  instant: HostInstant,
  timeZoneId: string,
  support: TimeZoneSupport
): CorrectedZonedTime {
  const offset = observeOffset(timeZoneId, instant);
  if (offset === undefined) {
    throw new UnknownTimeZoneError(timeZoneId);
  }
  const label = "ruleId" in support ? labels[support.ruleId] : undefined;
  return Object.freeze({
    instant: instant.toString(),
    timeZoneId,
    offset,
    ...(label && { label }),
    support
  });
}
