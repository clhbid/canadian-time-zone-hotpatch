/**
 * Public types for `@clhbid/canadian-time-zone-hotpatch`.
 */

/** Temporal's own disambiguation modes, re-exported for input typing. */
export type Disambiguation = "compatible" | "earlier" | "later" | "reject";

/**
 * Support status for a time zone identifier, as observed on the running host:
 *
 * - `current` — the host's own time zone data already agrees with the rule
 *   (or the rule does not yet apply at the probed instant).
 * - `stale` — the host reports a legacy seasonal offset where the rule
 *   mandates a permanent one; correction is required.
 * - `not_applicable` — the identifier is a valid, recognized time zone, but
 *   it is not governed by any rule in this package.
 * - `unknown` — the identifier could not be recognized as a valid time zone
 *   at all.
 */
export type TimeZoneSupportStatus =
  "current" | "stale" | "not_applicable" | "unknown";

/** A source citation backing a rule's effective and divergence instants. */
export interface RuleCitation {
  readonly title: string;
  readonly url: string;
}

/** A correction rule for a Canadian time zone moving to a permanent UTC offset. */
export interface TimeZoneRule {
  /** Stable identifier for this rule. */
  readonly ruleId: string;
  /** Canonical IANA time zone identifier this rule governs. */
  readonly canonicalTimeZoneId: string;
  /** Recognized IANA aliases/links that normalize to `canonicalTimeZoneId`. */
  readonly aliases: readonly string[];
  /** Human-readable jurisdiction name (for diagnostics, not for display). */
  readonly jurisdiction: string;
  /** Permanent UTC offset mandated by the rule, e.g. `"-06:00"`. */
  readonly offset: string;
  /** Fixed-offset `Etc/GMT` zone equivalent to `offset`, used for correction. */
  readonly fixedTimeZoneId: string;
  /** Instant the legislated offset legally commences (comes into force). */
  readonly legalEffectiveInstant: string;
  /** First instant a legacy (seasonal) host and the rule disagree. */
  readonly firstDivergenceInstant: string;
  /** Source citation(s) for this rule. */
  readonly citations: readonly RuleCitation[];
}

/** Result of inspecting a time zone identifier's host support. */
export interface TimeZoneSupport {
  readonly status: TimeZoneSupportStatus;
  /** The normalized (alias-resolved) time zone identifier that was inspected. */
  readonly timeZoneId: string;
  readonly ruleId?: string;
  /** Offset the rule mandates at the probed instant, e.g. `"-06:00"`. */
  readonly expectedOffset?: string;
  /** Offset the host actually reports at the probed instant. */
  readonly observedOffset?: string;
  /** First instant at which the host and the rule are known to disagree. */
  readonly firstDivergence?: string;
}

export interface InspectTimeZoneSupportInput {
  readonly timeZoneId: string;
  /** ISO 8601 instant to probe. Omit for an unbiased, rule-owned probe. */
  readonly instant?: string;
}

export interface ResolveTimeZoneInput {
  /** ISO 8601 instant to resolve, e.g. `"2026-11-01T09:00:00Z"`. */
  readonly instant: string;
  readonly timeZoneId: string;
  readonly locale?: Intl.LocalesArgument;
}

export interface ResolveLocalDateTimeInput {
  /**
   * ISO 8601 local (wall-clock) date-time, e.g. `"2026-11-01T01:30:00"`. A
   * UTC offset or `Z` designator is rejected, because a wall-clock time
   * carries no offset of its own.
   */
  readonly localDateTime: string;
  readonly timeZoneId: string;
  readonly disambiguation: Disambiguation;
  readonly locale?: Intl.LocalesArgument;
}

export interface ResolvedTimeZone {
  /** The (possibly corrected) instant, re-serialized in RFC 9557 form. */
  readonly instant: string;
  /** The time zone identifier actually used to compute `offset` — the
   * canonical named zone when current, or the fixed `Etc/GMT` zone when stale. */
  readonly timeZoneId: string;
  readonly offset: string;
  readonly label: string;
  readonly support: TimeZoneSupport;
}

export interface ResolvedLocalDateTime {
  readonly instant: string;
  readonly timeZoneId: string;
  readonly offset: string;
  readonly label: string;
  readonly support: TimeZoneSupport;
}

/** A locale-keyed dictionary of rule-id-keyed labels. */
export type TranslationDictionary = Readonly<
  Record<string, Readonly<Record<string, string>>>
>;

export interface HotpatchConfig {
  readonly rules: readonly TimeZoneRule[];
  readonly translations: TranslationDictionary;
  readonly fallbackLocale: string;
}

export interface TimeZoneHotpatch {
  inspectTimeZoneSupport(input: InspectTimeZoneSupportInput): TimeZoneSupport;
  resolveTimeZone(input: ResolveTimeZoneInput): ResolvedTimeZone;
  resolveLocalDateTime(input: ResolveLocalDateTimeInput): ResolvedLocalDateTime;
}
