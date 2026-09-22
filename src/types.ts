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

/** A configured, immutable instance exposing the same behaviour as the package root. */
export interface TimeZoneHotpatch {
  readonly config: HotpatchConfig;
  inspectTimeZoneSupport(input: InspectTimeZoneSupportInput): TimeZoneSupport;
}
