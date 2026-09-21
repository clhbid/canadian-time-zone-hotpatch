import { afterEach, describe, expect, it, vi } from "vitest";
import type { HostModule } from "./fixtures/simulated-host.js";
import { Temporal as PolyfillTemporal } from "temporal-polyfill";

const hostState = vi.hoisted(() => ({ tzdata: "stale" as "stale" | "current" }));

// Host observations are simulated so these assertions do not depend on the
// runner's installed tzdata.
vi.mock("../src/host.js", async (importOriginal) => {
  const actual = await importOriginal<HostModule>();
  const { simulatedHostModule } = await import("./fixtures/simulated-host.js");
  return simulatedHostModule(actual, hostState);
});

const globalWithTemporal = globalThis as { Temporal?: unknown };
const originalGlobalTemporal = globalWithTemporal.Temporal;

/**
 * A distinct — but API-compatible — namespace object, so that preferring the
 * global can be told apart from silently falling back to the polyfill.
 */
function createNativeLikeTemporal(): typeof PolyfillTemporal {
  return Object.create(PolyfillTemporal) as typeof PolyfillTemporal;
}

afterEach(() => {
  if (originalGlobalTemporal === undefined) {
    delete globalWithTemporal.Temporal;
  } else {
    globalWithTemporal.Temporal = originalGlobalTemporal;
  }
  hostState.tzdata = "stale";
  vi.resetModules();
});

describe("Temporal implementation selection", () => {
  it("uses the bundled temporal-polyfill when no native Temporal is present", async () => {
    delete globalWithTemporal.Temporal;
    vi.resetModules();
    const { Temporal } = await import("../src/temporal.js");
    expect(Temporal).toBe(PolyfillTemporal);
  });

  it("prefers a native-shaped Temporal global over the bundled polyfill", async () => {
    // Simulates a host that provides its own (API-compatible) Temporal,
    // without this package ever assigning to globalThis itself.
    const nativeLike = createNativeLikeTemporal();
    globalWithTemporal.Temporal = nativeLike;
    vi.resetModules();
    const { Temporal } = await import("../src/temporal.js");
    expect(Temporal).toBe(nativeLike);
    expect(Temporal).not.toBe(PolyfillTemporal);
  });

  it("never assigns to globalThis.Temporal itself", async () => {
    delete globalWithTemporal.Temporal;
    vi.resetModules();
    await import("../src/temporal.js");
    expect(globalWithTemporal.Temporal).toBeUndefined();
  });
});

describe("package behaviour with a simulated native Temporal global", () => {
  it("produces the same resolution results as with the bundled polyfill", async () => {
    globalWithTemporal.Temporal = createNativeLikeTemporal();
    vi.resetModules();
    const { resolveTimeZone } = await import("../src/index.js");
    const result = resolveTimeZone({
      instant: "2026-11-02T12:00:00Z",
      timeZoneId: "America/Edmonton",
    });
    expect(result.offset).toBe("-06:00");
    expect(result.timeZoneId).toBe("Etc/GMT+6");
  });

  it("keeps the canonical zone when the native global's tzdata is current", async () => {
    globalWithTemporal.Temporal = createNativeLikeTemporal();
    hostState.tzdata = "current";
    vi.resetModules();
    const { resolveTimeZone } = await import("../src/index.js");
    const result = resolveTimeZone({
      instant: "2026-11-02T12:00:00Z",
      timeZoneId: "America/Edmonton",
    });
    expect(result.support.status).toBe("current");
    expect(result.timeZoneId).toBe("America/Edmonton");
  });
});
