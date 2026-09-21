/**
 * Internal rule and translation types for the package foundation.
 */

export type RuleId =
  | "ab-permanent-time-2026"
  | "bc-permanent-time-2026"
  | "mb-permanent-time-2026";

/** A source citation backing a rule's effective and divergence instants. */
export interface RuleCitation {
  readonly title: string;
  readonly url: string;
}

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
  /** Source citation(s) for this rule. */
  readonly citations: readonly RuleCitation[];
}

/** A locale-keyed dictionary of rule-id-keyed labels. */
export type TranslationDictionary = Readonly<
  Record<string, Readonly<Partial<Record<RuleId, string>>>>
>;
