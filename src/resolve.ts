/**
 * Corrected calculations in both directions: an instant to the offset and
 * label it should display with, and a wall-clock time to the instant it
 * denotes. Both directions decide on the same inspection logic: a current
 * host keeps the canonical named zone, a stale host uses the rule's fixed
 * `Etc/GMT` zone, an ungoverned zone passes through to host Temporal, and an
 * unknown zone fails rather than guessing a jurisdiction.
 */
import type { HostInstant, HostPlainDateTime } from "./host.js";
import { isKnownTimeZoneId, observeInstant, observeOffset } from "./host.js";
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

/** A UTC offset or `Z` following the time part of an ISO 8601 string. */
const offsetDesignator =
  /[Tt ]\d{2}(?::?\d{2}){0,2}(?:[.,]\d+)?(?:[Zz]|[+-]\d{2}(?::?\d{2})?)/;

export function resolveTimeZone(
  config: HotpatchConfig,
  input: ResolveTimeZoneInput
): ResolvedTimeZone {
  const support = inspectTimeZoneSupport(input);
  if (support.status === "unknown") {
    throw new UnknownTimeZoneError(input.timeZoneId);
  }
  return resolved(
    config,
    Temporal.Instant.from(input.instant),
    effectiveTimeZoneId(support),
    support,
    input.locale
  );
}

export function resolveLocalDateTime(
  config: HotpatchConfig,
  input: ResolveLocalDateTimeInput
): ResolvedLocalDateTime {
  // `Temporal.PlainDateTime.from` discards a numeric offset silently, which
  // would quietly reinterpret a supplied instant as wall time.
  if (offsetDesignator.test(input.localDateTime)) {
    throw new OffsetBearingLocalDateTimeError(input.localDateTime);
  }
  const local = Temporal.PlainDateTime.from(input.localDateTime);

  const rule = findRule(input.timeZoneId);
  if (!rule && !isKnownTimeZoneId(input.timeZoneId)) {
    throw new UnknownTimeZoneError(input.timeZoneId);
  }

  let timeZoneId = rule ? rule.canonicalTimeZoneId : input.timeZoneId;
  let support: TimeZoneSupport | undefined;
  if (rule && !isBeforeDivergenceDate(rule, local)) {
    // A stale host repeats the divergence day's skipped hour and mis-offsets
    // every wall time after it, so from that calendar day on the rule-owned
    // probe decides the zone. Before it, seasonal host data is correct.
    support = inspectTimeZoneSupport({ timeZoneId: rule.canonicalTimeZoneId });
    if (support.status === "unknown") {
      throw new UnknownTimeZoneError(input.timeZoneId);
    }
    timeZoneId = effectiveTimeZoneId(support);
  }

  const instant = observeInstant(timeZoneId, local, input.disambiguation);
  return resolved(
    config,
    instant,
    timeZoneId,
    support ??
      inspectTimeZoneSupport({
        timeZoneId: input.timeZoneId,
        instant: instant.toString()
      }),
    input.locale
  );
}

/** The zone that computes correct offsets: the rule's fixed zone on a stale host, else the zone itself. */
function effectiveTimeZoneId(support: TimeZoneSupport): string {
  return support.status === "stale"
    ? (findRule(support.timeZoneId)?.fixedTimeZoneId ?? support.timeZoneId)
    : support.timeZoneId;
}

function isBeforeDivergenceDate(
  rule: TimeZoneRule,
  local: HostPlainDateTime
): boolean {
  const divergenceDate = Temporal.Instant.from(rule.firstDivergenceInstant)
    .toZonedDateTimeISO(rule.fixedTimeZoneId)
    .toPlainDate();
  return Temporal.PlainDate.compare(local.toPlainDate(), divergenceDate) < 0;
}

function resolved(
  config: HotpatchConfig,
  instant: HostInstant,
  timeZoneId: string,
  support: TimeZoneSupport,
  locale: Intl.LocalesArgument | undefined
): ResolvedTimeZone {
  const offset = observeOffset(timeZoneId, instant);
  if (offset === undefined) {
    throw new UnknownTimeZoneError(support.timeZoneId);
  }
  return Object.freeze({
    instant: instant.toString(),
    timeZoneId,
    offset,
    ...(support.ruleId && {
      label: resolveLabel(
        config.translations,
        config.fallbackLocale,
        support.ruleId,
        locale
      )
    }),
    support
  });
}
