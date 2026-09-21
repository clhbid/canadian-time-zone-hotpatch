import { afterEach, describe, expect, it, vi } from "vitest";
import { Temporal as PolyfillTemporal } from "temporal-polyfill";

const globalWithTemporal = globalThis as { Temporal?: unknown };
const originalGlobalTemporal = globalWithTemporal.Temporal;

afterEach(() => {
  if (originalGlobalTemporal === undefined) {
    delete globalWithTemporal.Temporal;
  } else {
    globalWithTemporal.Temporal = originalGlobalTemporal;
  }
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
    globalWithTemporal.Temporal = PolyfillTemporal;
    vi.resetModules();
    const { Temporal } = await import("../src/temporal.js");
    expect(Temporal).toBe(PolyfillTemporal);
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
    globalWithTemporal.Temporal = PolyfillTemporal;
    vi.resetModules();
    const { resolveTimeZone } = await import("../src/index.js");
    const result = resolveTimeZone({
      instant: "2026-11-02T12:00:00Z",
      timeZoneId: "America/Edmonton",
    });
    expect(result.offset).toBe("-06:00");
    expect(result.timeZoneId).toBe("Etc/GMT+6");
  });
});
