/**
 * Public types for `@clhbid/canadian-time-zone-hotpatch`.
 */

export type RuleId =
  | "ab-permanent-time-2026"
  | "bc-permanent-time-2026"
  | "mb-permanent-time-2026";

/** Approved display names for a governed zone, e.g. `"Alberta Time"` and `"ABT"`. */
export interface TimeZoneLabel {
  readonly long: string;
  readonly short: string;
}

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

/**
 * Support for the zone a correction actually inspected. Governed zones
 * (`current` and `stale`) carry the canonical identifier and the rule that
 * classified them; ungoverned zones carry only the identifier as given.
 */
export type TimeZoneSupport =
  | {
      readonly status: "current" | "stale";
      /** The canonical identifier of the governed zone. */
      readonly timeZoneId: string;
      readonly ruleId: RuleId;
    }
  | {
      readonly status: "not_applicable" | "unknown";
      /** The identifier as given. */
      readonly timeZoneId: string;
    };

/** Whether the running host's time zone data knows the rules this package patches. */
export interface HostSupport {
  /** `stale` when any governed rule is stale on this host. */
  readonly status: "current" | "stale";
  /** The rules this host has not caught up with, in rule-table order; empty when `current`. */
  readonly staleRuleIds: readonly RuleId[];
}

/** Temporal's disambiguation modes for ambiguous or nonexistent wall-clock times. */
export type Disambiguation = "compatible" | "earlier" | "later" | "reject";

/** Input to `toCorrectedZonedTime`. */
export interface ToCorrectedZonedTimeInput {
  /** ISO 8601 instant to display, e.g. `"2026-11-15T12:00:00Z"`. */
  readonly instant: string;
  /** IANA time zone identifier, matched case-insensitively; aliases are accepted. */
  readonly timeZoneId: string;
}

/** Input to `toCorrectedInstant`. */
export interface ToCorrectedInstantInput {
  /**
   * ISO 8601 wall-clock date-time, e.g. `"2026-11-01T01:30:00"`. A UTC
   * offset or `Z` designator is rejected: a wall-clock time has no offset of
   * its own, and silently discarding one would reinterpret an instant.
   */
  readonly wallTime: string;
  /** IANA time zone identifier, matched case-insensitively; aliases are accepted. */
  readonly timeZoneId: string;
  /** How to resolve a wall-clock time the effective zone repeats or skips. */
  readonly disambiguation: Disambiguation;
}

/** A corrected instant together with the zone that produced it. */
export interface CorrectedZonedTime {
  /** The corrected instant in ISO 8601 UTC form. */
  readonly instant: string;
  /**
   * The zone used to compute `offset`: the canonical named zone when the
   * host is current or the zone is ungoverned, or the rule's fixed `Etc/GMT`
   * zone when the host is stale. Format with this zone, not the one passed.
   */
  readonly timeZoneId: string;
  /** UTC offset at `instant` in the effective zone, e.g. `"-06:00"`. */
  readonly offset: string;
  /** Approved label for the governing rule; absent for ungoverned zones. */
  readonly label?: TimeZoneLabel;
  /**
   * The inspection that chose `timeZoneId`: `stale` exactly when the fixed
   * zone was used. For an instant this is support at that instant; for a
   * wall-clock time on or after the divergence day it is the rule-owned probe.
   */
  readonly support: TimeZoneSupport;
}
