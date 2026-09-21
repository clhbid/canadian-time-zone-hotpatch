import { afterEach, describe, expect, it, vi } from "vitest";
import { Temporal as PolyfillTemporal } from "temporal-polyfill";

describe("temporal selection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("prefers a global Temporal implementation when one is already available", async () => {
    const globalTemporal = {
      Instant: { from: vi.fn() },
      ZonedDateTime: class ZonedDateTime {},
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
});
