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
import { findRule } from "./rules.js";
import { Temporal } from "./temporal.js";
import { resolveLabel } from "./translations.js";
import type {
  HotpatchConfig,
  ResolvedLocalDateTime,
  ResolvedTimeZone,
  ResolveLocalDateTimeInput,
  ResolveTimeZoneInput,
  TimeZoneRule,
  TimeZoneSupport
} from "./types.js";

/** Thrown when resolution is asked for a zone the host does not recognize. */
export class UnknownTimeZoneError extends RangeError {
  constructor(timeZoneId: string) {
    super(`Cannot resolve unknown time zone identifier: "${timeZoneId}"`);
    this.name = "UnknownTimeZoneError";
  }
}

/** Thrown when a wall-clock date-time carries a UTC offset or `Z` designator. */
export class OffsetBearingLocalDateTimeError extends RangeError {
  constructor(localDateTime: string) {
    super(
      `Local date-time must not carry a UTC offset or "Z": "${localDateTime}". ` +
        "Use resolveTimeZone to resolve an instant."
    );
    this.name = "OffsetBearingLocalDateTimeError";
  }
}

/** A UTC offset or `Z` closing the time part, ahead of any bracketed annotation. */
const offsetDesignator = /[Tt ].*(?:[Zz]|[+-]\d{2}(?::?\d{2})?)$/;

/**
 * Resolves an instant for display. Throws `UnknownTimeZoneError` for a zone
 * the host does not recognize and Temporal's `RangeError` for a malformed
 * instant.
 */
export function resolveTimeZone(
  config: HotpatchConfig,
  input: ResolveTimeZoneInput
): ResolvedTimeZone {
  const support = inspectTimeZoneSupport(input);
  if (support.status === "unknown") {
    throw new UnknownTimeZoneError(input.timeZoneId);
  }
  const rule = findRule(support.timeZoneId);
  return toResolvedTimeZone(
    config,
    Temporal.Instant.from(input.instant),
    effectiveTimeZoneId(support, rule),
    support,
    input.locale
  );
}

/**
 * Resolves a wall-clock time to the instant it denotes. Throws
 * `OffsetBearingLocalDateTimeError` when the input carries a UTC offset or
 * `Z`, `UnknownTimeZoneError` for a zone the host does not recognize, and
 * Temporal's `RangeError` for a malformed wall time or, under `reject`, a
 * repeated or skipped one.
 */
export function resolveLocalDateTime(
  config: HotpatchConfig,
  input: ResolveLocalDateTimeInput
): ResolvedLocalDateTime {
  // `Temporal.PlainDateTime.from` discards a numeric offset silently, even an
  // invalid one, which would quietly reinterpret a supplied instant as wall
  // time.
  if (offsetDesignator.test(input.localDateTime.replace(/\[.*$/, ""))) {
    throw new OffsetBearingLocalDateTimeError(input.localDateTime);
  }
  const local = Temporal.PlainDateTime.from(input.localDateTime);

  const probe = inspectTimeZoneSupport({ timeZoneId: input.timeZoneId });
  if (probe.status === "unknown") {
    throw new UnknownTimeZoneError(input.timeZoneId);
  }

  // A stale host repeats the divergence day's skipped hour and mis-offsets
  // every wall time after it, so from that calendar day on the rule-owned
  // probe decides the zone. Before it, seasonal host data is correct and
  // the host's own disambiguation applies.
  const rule = findRule(probe.timeZoneId);
  const probeDecides =
    rule !== undefined && !isBeforeDivergenceDate(rule, local);
  const timeZoneId = probeDecides
    ? effectiveTimeZoneId(probe, rule)
    : probe.timeZoneId;

  const instant = observeInstant(timeZoneId, local, input.disambiguation);
  const support = probeDecides
    ? probe
    : inspectTimeZoneSupport({
        timeZoneId: probe.timeZoneId,
        instant: instant.toString()
      });
  return toResolvedTimeZone(config, instant, timeZoneId, support, input.locale);
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
  rule: TimeZoneRule,
  local: HostPlainDateTime
): boolean {
  // The rule's instant is written in local time, so its wall date needs no
  // host zone data.
  const divergenceDate = Temporal.PlainDate.from(rule.firstDivergenceInstant);
  return Temporal.PlainDate.compare(local.toPlainDate(), divergenceDate) < 0;
}

function toResolvedTimeZone(
  config: HotpatchConfig,
  instant: HostInstant,
  timeZoneId: string,
  support: TimeZoneSupport,
  locale: Intl.LocalesArgument | undefined
): ResolvedTimeZone {
  const offset = observeOffset(timeZoneId, instant);
  if (offset === undefined) {
    throw new UnknownTimeZoneError(timeZoneId);
  }
  const label =
    "ruleId" in support
      ? resolveLabel(
          config.translations,
          config.fallbackLocale,
          support.ruleId,
          locale
        )
      : undefined;
  return Object.freeze({
    instant: instant.toString(),
    timeZoneId,
    offset,
    ...(label && { label }),
    support
  });
}
