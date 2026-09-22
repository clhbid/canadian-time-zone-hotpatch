/**
 * Public types for `@clhbid/canadian-time-zone-hotpatch`.
 */

export type RuleId =
  | "ab-permanent-time-2026"
  | "bc-permanent-time-2026"
  | "mb-permanent-time-2026";

/** A correction rule for a Canadian time zone moving to a permanent UTC offset. */
export interface TimeZoneRule {
  /** Stable identifier for this rule. */
  readonly ruleId: RuleId;
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
  /** Instant the legislated offset legally commences, when it has been enacted. */
  readonly legalEffectiveInstant?: string;
  /** First instant a legacy (seasonal) host and the rule disagree. */
  readonly firstDivergenceInstant: string;
}

/** A locale-keyed dictionary of rule-id-keyed labels. */
export type TranslationDictionary = Readonly<
  Record<string, Readonly<Partial<Record<RuleId, string>>>>
>;

/**
 * How the running host's own time zone data relates to a rule:
 *
 * - `current` — the host agrees with the rule at the probed instant, or the
 *   rule has not yet diverged from seasonal time there, so no correction is
 *   required.
 * - `stale` — the host reports a legacy seasonal offset where the rule
 *   mandates a permanent one; correction is required.
 * - `not_applicable` — a valid time zone that no rule in this package governs.
 * - `unknown` — the identifier is not a time zone the host recognizes.
 */
export type TimeZoneSupportStatus =
  "current" | "stale" | "not_applicable" | "unknown";

export interface InspectTimeZoneSupportInput {
  /**
   * IANA time zone identifier. Governed zones and their aliases are matched
   * case-insensitively by the package; every other identifier is matched by
   * the host, which is also case-insensitive for IANA identifiers.
   */
  readonly timeZoneId: string;
  /**
   * ISO 8601 instant to classify. Omit to probe at the governing rule's first
   * divergence, which answers "does this host know the rule?" without caller
   * bias — the form to use for telemetry.
   */
  readonly instant?: string;
}

/**
 * Result of inspecting a time zone identifier's support on the running host.
 * Governed zones (`current` and `stale`) carry the diagnostics telemetry
 * aggregates; ungoverned zones carry only the identifier as given.
 */
export type TimeZoneSupport =
  | {
      readonly status: "current" | "stale";
      /** The canonical identifier of the governed zone. */
      readonly timeZoneId: string;
      readonly ruleId: RuleId;
      /** Offset the rule requires at the probed instant, e.g. `"-06:00"`. */
      readonly expectedOffset: string;
      /** Offset the host reports at the probed instant. */
      readonly observedOffset: string;
      /** First instant a legacy host and the governing rule disagree. */
      readonly firstDivergence: string;
    }
  | {
      readonly status: "not_applicable" | "unknown";
      /** The identifier as given. */
      readonly timeZoneId: string;
    };

export interface HotpatchConfig {
  /** The package's built-in, source-cited rules; configuration cannot change them. */
  readonly rules: readonly TimeZoneRule[];
  readonly translations: TranslationDictionary;
  /** Locale whose labels are used when a requested locale has none. */
  readonly fallbackLocale: string;
}

/** Temporal's disambiguation modes for ambiguous or nonexistent wall-clock times. */
export type Disambiguation = "compatible" | "earlier" | "later" | "reject";

/** Input to {@link TimeZoneHotpatch.resolveTimeZone}. */
export interface ResolveTimeZoneInput {
  /** ISO 8601 instant to resolve, e.g. `"2026-11-15T12:00:00Z"`. */
  readonly instant: string;
  /** IANA time zone identifier, matched case-insensitively; aliases are accepted. */
  readonly timeZoneId: string;
  /** Locale(s) for the label, in preference order; falls back to the configured locale. */
  readonly locale?: Intl.LocalesArgument;
}

/** Input to {@link TimeZoneHotpatch.resolveLocalDateTime}. */
export interface ResolveLocalDateTimeInput {
  /**
   * ISO 8601 wall-clock date-time, e.g. `"2026-11-01T01:30:00"`. A UTC
   * offset or `Z` designator is rejected: a wall-clock time has no offset of
   * its own, and silently discarding one would reinterpret an instant.
   */
  readonly localDateTime: string;
  /** IANA time zone identifier, matched case-insensitively; aliases are accepted. */
  readonly timeZoneId: string;
  /** How to resolve a wall-clock time the effective zone repeats or skips. */
  readonly disambiguation: Disambiguation;
  /** Locale(s) for the label, in preference order; falls back to the configured locale. */
  readonly locale?: Intl.LocalesArgument;
}

/** A corrected instant together with the zone that produced it. */
export interface ResolvedTimeZone {
  /** The resolved instant in ISO 8601 UTC form. */
  readonly instant: string;
  /**
   * The zone used to compute `offset`: the canonical named zone when the
   * host is current or the zone is ungoverned, or the rule's fixed `Etc/GMT`
   * zone when the host is stale.
   */
  readonly timeZoneId: string;
  /** UTC offset at `instant` in the effective zone, e.g. `"-06:00"`. */
  readonly offset: string;
  /** Approved label for the governing rule; absent for ungoverned zones. */
  readonly label?: string;
  /**
   * The inspection that chose `timeZoneId`: `stale` exactly when the fixed
   * zone was used. For an instant this is support at that instant; for a
   * wall-clock time on or after the divergence day it is the rule-owned probe.
   */
  readonly support: TimeZoneSupport;
}

/** A corrected instant for a wall-clock time, together with the zone that produced it. */
export type ResolvedLocalDateTime = ResolvedTimeZone;

/** A configured, immutable instance exposing the same behaviour as the package root. */
export interface TimeZoneHotpatch {
  readonly config: HotpatchConfig;
  inspectTimeZoneSupport(input: InspectTimeZoneSupportInput): TimeZoneSupport;
  /** Resolves an instant for display, correcting the zone when the host is stale. */
  resolveTimeZone(input: ResolveTimeZoneInput): ResolvedTimeZone;
  /** Resolves a wall-clock time to the legislated instant, correcting when the host is stale. */
  resolveLocalDateTime(input: ResolveLocalDateTimeInput): ResolvedLocalDateTime;
}
