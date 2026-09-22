/**
 * The single place this package reads the running host's own time zone data.
 *
 * Every offset the package observes goes through `observeOffset`, so host
 * behaviour (stale or current tzdata) can be simulated deterministically in
 * tests instead of depending on the test runner's installed tzdata.
 */
import type { Temporal } from "temporal-spec";
import type { TemporalNamespace } from "./temporal.js";
import type { Disambiguation } from "./types.js";

export type HostInstant = Temporal.Instant;
export type HostPlainDateTime = Temporal.PlainDateTime;

/** Offset the host reports for `timeZoneId` at `instant`, or `undefined` if invalid. */
export function observeOffset(
  timeZoneId: string,
  instant: HostInstant
): string | undefined {
  try {
    return instant.toZonedDateTimeISO(timeZoneId).offset;
  } catch {
    return undefined;
  }
}

/** Whether the host recognizes `timeZoneId` as a time zone identifier. */
export function isKnownTimeZoneId(
  temporal: TemporalNamespace,
  timeZoneId: string
): boolean {
  // Any instant serves to test whether the host recognizes a zone.
  const epoch = temporal.Instant.fromEpochMilliseconds(0);
  return observeOffset(timeZoneId, epoch) !== undefined;
}

/**
 * Instant the host assigns to the wall-clock time `local` in `timeZoneId`.
 * Throws Temporal's `RangeError` for an unrecognized zone, and under
 * `disambiguation: "reject"` when the host repeats or skips `local`.
 */
export function observeInstant(
  timeZoneId: string,
  local: HostPlainDateTime,
  disambiguation: Disambiguation
): HostInstant {
  return local.toZonedDateTime(timeZoneId, { disambiguation }).toInstant();
}
