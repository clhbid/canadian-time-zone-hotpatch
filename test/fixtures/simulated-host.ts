/**
 * A deterministic stand-in for the running host's time zone data.
 *
 * `observeOffset` ultimately reads named-zone offsets from the host's own
 * `Intl` data, so asserting `stale` or `current` against the real host would
 * depend on the runner's installed tzdata. This fixture models both a legacy
 * (seasonal) host and an updated (permanent-offset) host for the governed
 * zones from first principles instead. Every other zone falls through to the
 * real host, whose answer does not depend on the tzdata under test.
 *
 * Use it from a `vi.mock("../src/host.js", …)` factory:
 *
 *     const hostState = vi.hoisted(() => ({ tzdata: "stale" as const }));
 *     vi.mock("../src/host.js", async (importOriginal) =>
 *       simulatedHostModule(await importOriginal(), hostState)
 *     );
 */
import type * as hostModule from "../../src/host.js";

export type HostModule = typeof hostModule;

/** Whether the simulated host's tzdata predates (`stale`) or knows (`current`) the rules. */
export type SimulatedTzdata = "stale" | "current";

/** Mutable holder letting a test switch the simulated tzdata per case. */
export interface SimulatedHostState {
  tzdata: SimulatedTzdata;
}

interface SeasonalZone {
  /** Offset outside the daylight-saving period, e.g. `"-07:00"`. */
  readonly standard: string;
  /** Offset during the daylight-saving period, e.g. `"-06:00"`. */
  readonly daylight: string;
  /** Year whose skipped "fall back" makes `daylight` permanent on a current host. */
  readonly permanentFromYear: number;
}

/** The governed zones under the North American seasonal rules in force since 2007. */
const seasonalZones: Readonly<Record<string, SeasonalZone>> = {
  "America/Edmonton": {
    standard: "-07:00",
    daylight: "-06:00",
    permanentFromYear: 2026
  },
  "America/Vancouver": {
    standard: "-08:00",
    daylight: "-07:00",
    permanentFromYear: 2026
  },
  "America/Winnipeg": {
    standard: "-06:00",
    daylight: "-05:00",
    permanentFromYear: 2026
  }
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

/** Epoch milliseconds of a local 02:00 clock change, given the offset in force before it. */
function transitionAt(
  year: number,
  month: number,
  nth: number,
  offsetBefore: string
): number {
  const day = nthSunday(year, month, nth);
  return Date.UTC(year, month, day, 2) - offsetToMilliseconds(offsetBefore);
}

/**
 * Offset a simulated host reports for `timeZoneId` at `epochMilliseconds`,
 * or `undefined` for a zone this fixture does not model.
 */
export function simulateHostOffset(
  tzdata: SimulatedTzdata,
  timeZoneId: string,
  epochMilliseconds: number
): string | undefined {
  const zone = seasonalZones[timeZoneId];
  if (!zone) {
    return undefined;
  }

  const permanentFrom = transitionAt(
    zone.permanentFromYear,
    10,
    1,
    zone.daylight
  );
  if (tzdata === "current" && epochMilliseconds >= permanentFrom) {
    return zone.daylight;
  }

  // Second Sunday in March at 02:00 standard time through the first Sunday
  // in November at 02:00 daylight time.
  const year = new Date(epochMilliseconds).getUTCFullYear();
  const daylightStart = transitionAt(year, 2, 2, zone.standard);
  const daylightEnd = transitionAt(year, 10, 1, zone.daylight);
  return epochMilliseconds >= daylightStart && epochMilliseconds < daylightEnd
    ? zone.daylight
    : zone.standard;
}

/**
 * Builds a replacement for `src/host.ts` whose observations for governed
 * zones come from `state.tzdata`, and from the real host for everything else.
 */
export function simulatedHostModule(
  actual: HostModule,
  state: SimulatedHostState
): HostModule {
  return {
    ...actual,
    isKnownTimeZoneId(timeZoneId) {
      return (
        timeZoneId in seasonalZones || actual.isKnownTimeZoneId(timeZoneId)
      );
    },
    observeOffset(timeZoneId, instant) {
      return (
        simulateHostOffset(
          state.tzdata,
          timeZoneId,
          instant.epochMilliseconds
        ) ?? actual.observeOffset(timeZoneId, instant)
      );
    }
  };
}
