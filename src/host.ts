/**
 * The single place this package reads the running host's own time zone data.
 *
 * Every offset the package observes goes through `observeOffset`, so host
 * behaviour (stale or current tzdata) can be simulated deterministically in
 * tests instead of depending on the test runner's installed tzdata.
 */
import { Temporal } from "./temporal.js";

export type HostInstant = ReturnType<typeof Temporal.Instant.from>;

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

/** Validates that `timeZoneId` is a time zone identifier the host recognizes. */
export function isKnownTimeZoneId(timeZoneId: string): boolean {
  try {
    Temporal.Now.zonedDateTimeISO(timeZoneId);
    return true;
  } catch {
    return false;
  }
}
