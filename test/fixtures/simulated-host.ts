/**
 * A deterministic stand-in for the running host's time zone data.
 *
 * `temporal-polyfill` reads named-zone offsets from the host's `Intl`, so any
 * test that asserts `stale` or `current` support against the real host is at
 * the mercy of the runner's installed tzdata. These helpers model both a
 * legacy (seasonal) host and an updated (permanent-offset) host from first
 * principles, so both branches stay deterministic forever.
 */
import type * as hostModule from "../../src/host.js";

export type SimulatedHostTzdata = "stale" | "current";

interface SeasonalZone {
  /** Offset observed outside the daylight-saving period, e.g. `"-07:00"`. */
  readonly standard: string;
  /** Offset observed during the daylight-saving period, e.g. `"-06:00"`. */
  readonly daylight: string;
  /** Year whose skipped "fall back" makes `daylight` permanent on a current host. */
  readonly permanentFromYear: number;
}

/** The governed zones, modeled with the North American seasonal rules in force since 2007. */
const seasonalZones: Readonly<Record<string, SeasonalZone>> = {
  "America/Edmonton": { standard: "-07:00", daylight: "-06:00", permanentFromYear: 2026 },
  "America/Vancouver": { standard: "-08:00", daylight: "-07:00", permanentFromYear: 2026 },
  "America/Winnipeg": { standard: "-06:00", daylight: "-05:00", permanentFromYear: 2026 },
};

function offsetToMilliseconds(offset: string): number {
  const sign = offset.startsWith("-") ? -1 : 1;
  const hours = Number(offset.slice(1, 3));
  const minutes = Number(offset.slice(4, 6));
  return sign * (hours * 60 + minutes) * 60_000;
}

/** Day of month of the `nth` Sunday in `month` (0-based) of `year`. */
function nthSunday(year: number, month: number, nth: number): number {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const firstSunday = 1 + ((7 - firstWeekday) % 7);
  return firstSunday + (nth - 1) * 7;
}

/** Epoch milliseconds of a local 02:00 clock change, given the offset in force beforehand. */
function transitionAt(year: number, month: number, nth: number, offsetBefore: string): number {
  const day = nthSunday(year, month, nth);
  return Date.UTC(year, month, day, 2) - offsetToMilliseconds(offsetBefore);
}

/**
 * Offset a simulated host reports for `timeZoneId` at `epochMilliseconds`, or
 * `undefined` for zones this fixture does not model (fixed `Etc/GMT` zones and
 * ungoverned named zones are left to the real implementation, whose behaviour
 * does not depend on the tzdata under test).
 */
export function simulateHostOffset(
  tzdata: SimulatedHostTzdata,
  timeZoneId: string,
  epochMilliseconds: number,
): string | undefined {
  const zone = seasonalZones[timeZoneId];
  if (!zone) {
    return undefined;
  }

  const permanentFrom = transitionAt(zone.permanentFromYear, 10, 1, zone.daylight);
  if (tzdata === "current" && epochMilliseconds >= permanentFrom) {
    return zone.daylight;
  }

  // Second Sunday in March at 02:00 standard time through the first Sunday in
  // November at 02:00 daylight time.
  const year = new Date(epochMilliseconds).getUTCFullYear();
  const daylightStart = transitionAt(year, 2, 2, zone.standard);
  const daylightEnd = transitionAt(year, 10, 1, zone.daylight);

  return epochMilliseconds >= daylightStart && epochMilliseconds < daylightEnd
    ? zone.daylight
    : zone.standard;
}

/** Mutable holder letting a test switch the simulated host's tzdata per case. */
export interface SimulatedHostState {
  tzdata: SimulatedHostTzdata;
}

/** The shape of `src/host.ts`, as replaced by {@link simulatedHostModule}. */
export type HostModule = typeof hostModule;

/**
 * Builds a replacement for `src/host.ts` whose observations come from
 * `state.tzdata` for governed zones, and from the real implementation for
 * everything else. Use it from a `vi.mock("../src/host.js", …)` factory.
 */
export function simulatedHostModule(actual: HostModule, state: SimulatedHostState): HostModule {
  return {
    ...actual,
    observeOffset(timeZoneId, instant) {
      return (
        simulateHostOffset(state.tzdata, timeZoneId, instant.epochMilliseconds) ??
        actual.observeOffset(timeZoneId, instant)
      );
    },
  };
}
