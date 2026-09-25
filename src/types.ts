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

/** Every value a `status` takes. */
export const TimeZoneSupportStatus = Object.freeze({
  /** The host agrees with the rule at the probed instant, before or after divergence. */
  current: "current",
  /** The host reports a seasonal offset where the rule mandates a permanent one. */
  stale: "stale",
  /** A zone this host recognizes and no rule governs. */
  not_applicable: "not_applicable",
  /** Not a zone this host recognizes; correcting one throws. */
  unknown: "unknown"
} as const);

/** How the running host's own time zone data relates to a rule. */
export type TimeZoneSupportStatus =
  (typeof TimeZoneSupportStatus)[keyof typeof TimeZoneSupportStatus];

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

/** A single rule's status on this host. */
export interface RuleSupport {
  readonly ruleId: RuleId;
  readonly status: Exclude<TimeZoneSupportStatus, "not_applicable" | "unknown">;
}

/** Whether the running host's time zone data knows the rules this package patches. */
export interface HostSupport {
  /** `stale` when any governed rule is stale on this host. */
  readonly status: "current" | "stale";
  /** Every rule's status on this host, in rule-table order. */
  readonly ruleSupport: readonly RuleSupport[];
}

/**
 * Every value a `disambiguation` takes; see
 * https://tc39.es/proposal-temporal/docs/timezone.html#resolving-time-ambiguity-in-temporal.
 */
export const Disambiguation = Object.freeze({
  /** Later at a skipped time, earlier at a repeated one. */
  compatible: "compatible",
  /** The earlier of the two instants. */
  earlier: "earlier",
  /** The later of the two instants. */
  later: "later",
  /** Throws the `RangeError` Temporal would throw. */
  reject: "reject"
} as const);

/** How a wall-clock time the zone repeats or skips resolves to an instant. */
export type Disambiguation =
  (typeof Disambiguation)[keyof typeof Disambiguation];

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

/** Input to `toTimeZoneLabel`. */
export interface ToTimeZoneLabelInput {
  /** ISO 8601 instant to label, e.g. `"2026-11-15T12:00:00Z"`. */
  readonly instant: string;
  /** IANA time zone identifier, matched case-insensitively; aliases are accepted. */
  readonly timeZoneId: string;
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
  /**
   * The inspection that chose `timeZoneId`: `stale` exactly when the fixed
   * zone was used. For an instant this is support at that instant; for a
   * wall-clock time on or after the divergence day it is the rule-owned probe.
   */
  readonly support: TimeZoneSupport;
}
