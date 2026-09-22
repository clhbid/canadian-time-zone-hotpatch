import { Temporal as PolyfillTemporal } from "temporal-polyfill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostModule, SimulatedTzdata } from "./fixtures/simulated-host.js";

const hostState = vi.hoisted(() => ({ tzdata: "stale" as SimulatedTzdata }));

vi.mock("../src/host.js", async (importOriginal) => {
  const actual = await importOriginal<HostModule>();
  const { simulatedHostModule } = await import("./fixtures/simulated-host.js");
  return simulatedHostModule(actual, hostState);
});

/**
 * A distinct but API-compatible namespace, so preferring the global can be
 * told apart from silently falling back to the polyfill.
 */
function createNativeLikeTemporal(): typeof PolyfillTemporal {
  return Object.create(PolyfillTemporal) as typeof PolyfillTemporal;
}

beforeEach(() => {
  hostState.tzdata = "stale";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("temporal selection", () => {
  it("prefers a global Temporal implementation when one is already available", async () => {
    const globalTemporal = {
      Instant: { from: vi.fn() },
      ZonedDateTime: class ZonedDateTime {}
    };

    vi.stubGlobal("Temporal", globalTemporal);

    const { Temporal } = await import("../src/temporal.js");

    expect(Temporal).toBe(globalTemporal);
  });

  it("falls back to temporal-polyfill when no global Temporal is available", async () => {
    vi.stubGlobal("Temporal", undefined);

    const { Temporal } = await import("../src/temporal.js");

    expect(Temporal).toBe(PolyfillTemporal);
  });

  it("never assigns to globalThis.Temporal", async () => {
    vi.stubGlobal("Temporal", undefined);

    await import("../src/index.js");

    expect((globalThis as { Temporal?: unknown }).Temporal).toBeUndefined();
  });
});

describe("resolution through a native-like Temporal global", () => {
  it("corrects a stale host the same way as through the polyfill", async () => {
    const nativeLike = createNativeLikeTemporal();
    vi.stubGlobal("Temporal", nativeLike);

    const { Temporal } = await import("../src/temporal.js");
    const { toCorrectedInstant, toCorrectedZonedTime } =
      await import("../src/index.js");

    expect(Temporal).toBe(nativeLike);
    expect(
      toCorrectedZonedTime({
        instant: "2026-11-02T12:00:00Z",
        timeZoneId: "America/Edmonton"
      })
    ).toMatchObject({ timeZoneId: "Etc/GMT+6", offset: "-06:00" });
    expect(
      toCorrectedInstant({
        wallTime: "2026-11-01T01:30:00",
        timeZoneId: "America/Edmonton",
        disambiguation: "compatible"
      })
    ).toMatchObject({ instant: "2026-11-01T07:30:00Z", offset: "-06:00" });
  });
});
