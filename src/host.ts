/**
 * The single place this package reads the running host's own time zone data.
 *
 * Every offset the package observes goes through `observeOffset`, so host
 * behaviour (stale or current tzdata) can be simulated deterministically in
 * tests instead of depending on the test runner's installed tzdata.
 */
import { Temporal } from "./temporal.js";
import type { Disambiguation } from "./types.js";

export type HostInstant = ReturnType<typeof Temporal.Instant.from>;
export type HostPlainDateTime = ReturnType<typeof Temporal.PlainDateTime.from>;

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

/** Any instant serves to test whether the host recognizes a zone. */
const epoch = Temporal.Instant.fromEpochMilliseconds(0);

/** Whether the host recognizes `timeZoneId` as a time zone identifier. */
export function isKnownTimeZoneId(timeZoneId: string): boolean {
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
