/**
 * Bidirectional resolution: instants to display-ready offsets/labels, and
 * local wall-time input to corrected instants. Both directions share the
 * same inspection logic from `inspectTimeZoneSupport`.
 */
import { Temporal } from "./temporal.js";
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

  const zoned = instant.toZonedDateTimeISO(effectiveTimeZoneId);

  return Object.freeze({
    instant: zoned.toInstant().toString(),
    timeZoneId: effectiveTimeZoneId,
    offset: zoned.offset,
    label: labelFor(translations, fallbackLocale, support, input.locale),
    support,
  });
}

export function resolveLocalDateTime(
  translations: TranslationDictionary,
  fallbackLocale: string,
  input: ResolveLocalDateTimeInput,
): ResolvedLocalDateTime {
  // Throws for malformed local date-times.
  const plain = Temporal.PlainDateTime.from(input.localDateTime);

  const rule = findRule(input.timeZoneId);
  const normalizedId = normalizeTimeZoneId(input.timeZoneId);

  if (!rule) {
    let zoned;
    try {
      zoned = plain.toZonedDateTime(normalizedId, { disambiguation: input.disambiguation });
    } catch {
      throw new UnknownTimeZoneError(input.timeZoneId);
    }
    const support = inspectTimeZoneSupport({ timeZoneId: input.timeZoneId });
    return Object.freeze({
      instant: zoned.toInstant().toString(),
      timeZoneId: normalizedId,
      offset: zoned.offset,
      label: labelFor(translations, fallbackLocale, support, input.locale),
      support,
    });
  }

  // Once the rule's first-divergence calendar date has arrived, the zone is
  // a fixed, permanent offset for the entire day (and forever after): there
  // is no ambiguous or nonexistent local time to disambiguate. Before that
  // date, defer to the host's own (still-accurate) seasonal rules and
  // disambiguation behaviour.
  const divergenceDate = Temporal.Instant.from(rule.firstDivergenceInstant)
    .toZonedDateTimeISO(rule.canonicalTimeZoneId)
    .toPlainDate();
  const isBeforeDivergence = Temporal.PlainDate.compare(plain.toPlainDate(), divergenceDate) < 0;

  const effectiveTimeZoneId = isBeforeDivergence ? rule.canonicalTimeZoneId : rule.fixedTimeZoneId;
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
