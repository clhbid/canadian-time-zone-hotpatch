/**
 * Bidirectional resolution: instants to display-ready offsets/labels, and
 * local wall-time input to corrected instants. Both directions share the
 * same inspection logic from `inspectTimeZoneSupport`.
 */
import { Temporal } from "./temporal.js";
import { isKnownTimeZoneId, observeOffset } from "./host.js";
import { findRule, normalizeTimeZoneId } from "./rules.js";
import { resolveLabel } from "./translations.js";
import type {
  ResolveLocalDateTimeInput,
  ResolveTimeZoneInput,
  ResolvedLocalDateTime,
  ResolvedTimeZone,
  TimeZoneSupport,
  TranslationDictionary,
} from "./types.js";
import { inspectTimeZoneSupport } from "./inspect.js";

/** Thrown when resolution is attempted for an unrecognized time zone identifier. */
export class UnknownTimeZoneError extends RangeError {
  constructor(timeZoneId: string) {
    super(`Cannot resolve unknown time zone identifier: "${timeZoneId}"`);
    this.name = "UnknownTimeZoneError";
  }
}

function labelFor(
  translations: TranslationDictionary,
  fallbackLocale: string,
  support: TimeZoneSupport,
  locale: Intl.LocalesArgument | undefined,
): string {
  if (!support.ruleId) {
    return support.timeZoneId;
  }
  return resolveLabel(translations, fallbackLocale, support.ruleId, locale);
}

export function resolveTimeZone(
  translations: TranslationDictionary,
  fallbackLocale: string,
  input: ResolveTimeZoneInput,
): ResolvedTimeZone {
  const support = inspectTimeZoneSupport({
    timeZoneId: input.timeZoneId,
    instant: input.instant,
  });

  if (support.status === "unknown") {
    throw new UnknownTimeZoneError(input.timeZoneId);
  }

  // Throws for malformed instants (including invalid explicit offsets).
  const instant = Temporal.Instant.from(input.instant);

  const rule = findRule(input.timeZoneId);
  const effectiveTimeZoneId =
    support.status === "stale" && rule
      ? rule.fixedTimeZoneId
      : normalizeTimeZoneId(input.timeZoneId);

  const offset = observeOffset(effectiveTimeZoneId, instant);
  if (offset === undefined) {
    throw new UnknownTimeZoneError(input.timeZoneId);
  }

  return Object.freeze({
    instant: instant.toString(),
    timeZoneId: effectiveTimeZoneId,
    offset,
    label: labelFor(translations, fallbackLocale, support, input.locale),
    support,
  });
}

/** Matches a UTC offset or `Z` designator attached to the time part of an ISO string. */
const OFFSET_BEARING = /[Tt ]\d{2}(?::?\d{2}){0,2}(?:[.,]\d+)?(?:[Zz]|[+-]\d{2}(?::?\d{2})?)/;

/** Thrown when a local (wall-clock) date-time carries a UTC offset or `Z`. */
export class OffsetBearingLocalDateTimeError extends RangeError {
  constructor(localDateTime: string) {
    super(
      `Local date-time must not carry a UTC offset or "Z" designator: "${localDateTime}". ` +
        `Use resolveTimeZone to resolve an instant.`,
    );
    this.name = "OffsetBearingLocalDateTimeError";
  }
}

export function resolveLocalDateTime(
  translations: TranslationDictionary,
  fallbackLocale: string,
  input: ResolveLocalDateTimeInput,
): ResolvedLocalDateTime {
  // `Temporal.PlainDateTime.from` silently discards any offset it is given,
  // which would quietly reinterpret a supplied instant as wall time.
  if (OFFSET_BEARING.test(input.localDateTime)) {
    throw new OffsetBearingLocalDateTimeError(input.localDateTime);
  }

  // Throws for malformed local date-times.
  const plain = Temporal.PlainDateTime.from(input.localDateTime);

  const rule = findRule(input.timeZoneId);
  const normalizedId = normalizeTimeZoneId(input.timeZoneId);

  // Decide whether the identifier is usable *before* converting, so that a
  // `RangeError` raised by `disambiguation: "reject"` is never mistaken for
  // an unrecognized time zone.
  if (!rule && !isKnownTimeZoneId(normalizedId)) {
    throw new UnknownTimeZoneError(input.timeZoneId);
  }

  if (!rule) {
    const zoned = plain.toZonedDateTime(normalizedId, { disambiguation: input.disambiguation });
    const support = inspectTimeZoneSupport({ timeZoneId: input.timeZoneId });
    return Object.freeze({
      instant: zoned.toInstant().toString(),
      timeZoneId: normalizedId,
      offset: zoned.offset,
      label: labelFor(translations, fallbackLocale, support, input.locale),
      support,
    });
  }

  // Before the rule's first-divergence calendar date, the host's own seasonal
  // rules are still accurate, so defer to them. On or after that date the
  // host may be stale: probe it, and only substitute the rule's fixed,
  // permanent offset when the host's data actually disagrees with the rule.
  const divergenceDate = Temporal.Instant.from(rule.firstDivergenceInstant)
    .toZonedDateTimeISO(rule.fixedTimeZoneId)
    .toPlainDate();
  const isBeforeDivergence = Temporal.PlainDate.compare(plain.toPlainDate(), divergenceDate) < 0;

  // The unbiased, rule-owned probe answers the host-state question ("does
  // this host know the rule?") independently of the wall time being resolved.
  const hostKnowsRule =
    isBeforeDivergence ||
    inspectTimeZoneSupport({ timeZoneId: input.timeZoneId }).status !== "stale";
  const effectiveTimeZoneId = hostKnowsRule ? rule.canonicalTimeZoneId : rule.fixedTimeZoneId;

  const zoned = plain.toZonedDateTime(effectiveTimeZoneId, {
    disambiguation: input.disambiguation,
  });

  const support = inspectTimeZoneSupport({
    timeZoneId: input.timeZoneId,
    instant: zoned.toInstant().toString(),
  });

  return Object.freeze({
    instant: zoned.toInstant().toString(),
    timeZoneId: effectiveTimeZoneId,
    offset: zoned.offset,
    label: labelFor(translations, fallbackLocale, support, input.locale),
    support,
  });
}
