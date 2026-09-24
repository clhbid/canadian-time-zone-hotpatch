import { Temporal as PolyfillTemporal } from "temporal-polyfill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHotpatch } from "../src/hotpatch.js";
import { MissingTemporalError } from "../src/index.js";
import type { TemporalNamespace } from "../src/temporal.js";
import type { HostModule, SimulatedTzdata } from "./fixtures/simulated-host.js";

const hostState = vi.hoisted(() => ({ tzdata: "stale" as SimulatedTzdata }));

vi.mock("../src/host.js", async (importOriginal) => {
  const actual = await importOriginal<HostModule>();
  const { simulatedHostModule } = await import("./fixtures/simulated-host.js");
  return simulatedHostModule(actual, hostState);
});

/** The correction every case below expects on a stale Alberta host. */
const edmonton = {
  instant: "2026-11-02T12:00:00Z",
  timeZoneId: "America/Edmonton"
} as const;
const corrected = { timeZoneId: "Etc/GMT+6", offset: "-06:00" };

/**
 * A namespace with the shape the package requires whose every static throws,
 * so a call that reaches for the global instead of a supplied namespace fails
 * rather than quietly agreeing.
 */
function trapNamespace(): TemporalNamespace {
  const trap = () => {
    throw new Error("the global Temporal was used");
  };
  const statics = (...names: string[]) =>
    Object.fromEntries(names.map((name) => [name, trap]));
  return {
    Instant: statics("from", "fromEpochMilliseconds", "compare"),
    PlainDateTime: statics("from"),
    PlainDate: statics("from", "compare")
  } as unknown as TemporalNamespace;
}

function namespaceCandidate() {
  return {
    Instant: {
      from: PolyfillTemporal.Instant.from,
      fromEpochMilliseconds: PolyfillTemporal.Instant.fromEpochMilliseconds,
      compare: PolyfillTemporal.Instant.compare
    },
    PlainDateTime: {
      from: PolyfillTemporal.PlainDateTime.from
    },
    PlainDate: {
      from: PolyfillTemporal.PlainDate.from,
      compare: PolyfillTemporal.PlainDate.compare
    }
  };
}

beforeEach(() => {
  hostState.tzdata = "stale";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a missing Temporal implementation", () => {
  it.each([
    "inspectHostSupport",
    "toCorrectedInstant",
    "toCorrectedZonedTime",
    "toTimeZoneLabel"
  ])(
    "throws MissingTemporalError from %s with no global and nothing supplied",
    async (name) => {
      vi.stubGlobal("Temporal", undefined);
      const pkg = await import("../src/index.js");
      const call = () =>
        (pkg[name as keyof typeof pkg] as (input: unknown) => unknown)({
          ...edmonton,
          wallTime: "2026-11-02T06:00:00",
          disambiguation: "compatible"
        });

      expect(call).toThrow(MissingTemporalError);
      // Both remedies are named, so the message says what to do next.
      expect(call).toThrow(/global Temporal/);
      expect(call).toThrow(/createHotpatch/);
    }
  );

  it.each([
    ["null", null],
    ["boolean", false],
    ["number", 42],
    ["bigint", 42n],
    ["string", "Temporal"],
    ["symbol", Symbol("Temporal")],
    ["empty object", {}],
    ["wrapped namespace", { Temporal: PolyfillTemporal }],
    ["missing Instant namespace", { PlainDateTime: {}, PlainDate: {} }],
    ["missing PlainDateTime namespace", { Instant: {}, PlainDate: {} }],
    ["missing PlainDate namespace", { Instant: {}, PlainDateTime: {} }],
    [
      "missing Instant.from",
      {
        ...namespaceCandidate(),
        Instant: {
          ...namespaceCandidate().Instant,
          from: undefined
        }
      }
    ],
    [
      "non-function Instant.fromEpochMilliseconds",
      {
        ...namespaceCandidate(),
        Instant: {
          ...namespaceCandidate().Instant,
          fromEpochMilliseconds: "nope"
        }
      }
    ],
    [
      "missing Instant.compare",
      {
        ...namespaceCandidate(),
        Instant: {
          ...namespaceCandidate().Instant,
          compare: undefined
        }
      }
    ],
    [
      "missing PlainDateTime.from",
      {
        ...namespaceCandidate(),
        PlainDateTime: {}
      }
    ],
    [
      "missing PlainDate.from",
      {
        ...namespaceCandidate(),
        PlainDate: {
          compare: PolyfillTemporal.PlainDate.compare
        }
      }
    ],
    [
      "non-function PlainDate.compare",
      {
        ...namespaceCandidate(),
        PlainDate: {
          ...namespaceCandidate().PlainDate,
          compare: "nope"
        }
      }
    ]
  ])(
    "throws MissingTemporalError from createHotpatch when temporal is %s",
    (_, invalid) => {
      expect(() =>
        createHotpatch({ temporal: invalid as unknown as TemporalNamespace })
      ).toThrow(MissingTemporalError);
    }
  );
});

describe("a global Temporal implementation", () => {
  it("is used by the top-level exports with no caller changes", async () => {
    vi.stubGlobal("Temporal", PolyfillTemporal);

    const { toCorrectedZonedTime } = await import("../src/index.js");

    expect(toCorrectedZonedTime(edmonton)).toMatchObject(corrected);
  });

  it("is picked up even when it is installed after the package is imported", async () => {
    vi.stubGlobal("Temporal", undefined);
    const { toCorrectedZonedTime } = await import("../src/index.js");
    expect(() => toCorrectedZonedTime(edmonton)).toThrow(MissingTemporalError);

    vi.stubGlobal("Temporal", PolyfillTemporal);

    expect(toCorrectedZonedTime(edmonton)).toMatchObject(corrected);
  });

  it("is never assigned by the package itself", async () => {
    vi.stubGlobal("Temporal", undefined);

    await import("../src/index.js");

    expect((globalThis as { Temporal?: unknown }).Temporal).toBeUndefined();
  });

  it("is not read, and nothing is thrown, when the package is imported", async () => {
    // A fresh evaluation, so the import itself is what the counter observes.
    vi.resetModules();
    let reads = 0;
    Object.defineProperty(globalThis, "Temporal", {
      configurable: true,
      get() {
        reads += 1;
        return undefined;
      }
    });

    try {
      await expect(import("../src/index.js")).resolves.toBeDefined();
      expect(reads).toBe(0);
    } finally {
      delete (globalThis as { Temporal?: unknown }).Temporal;
      vi.resetModules();
    }
  });
});

describe("a supplied Temporal implementation", () => {
  it("is used in preference to a global one", () => {
    vi.stubGlobal("Temporal", trapNamespace());

    const {
      inspectHostSupport,
      toCorrectedInstant,
      toCorrectedZonedTime,
      toTimeZoneLabel
    } = createHotpatch({ temporal: PolyfillTemporal });

    expect(toCorrectedZonedTime(edmonton)).toMatchObject(corrected);
    expect(
      toCorrectedInstant({
        wallTime: "2026-11-01T01:30:00",
        timeZoneId: "America/Edmonton",
        disambiguation: "compatible"
      })
    ).toMatchObject({ instant: "2026-11-01T07:30:00Z", offset: "-06:00" });
    expect(inspectHostSupport().status).toBe("stale");
    // Asserting the label, not merely that nothing threw: this lookup
    // swallows what it catches, so reaching for the trapped global would
    // surface as a silent `undefined` rather than as an error.
    expect(toTimeZoneLabel(edmonton)).toEqual({
      long: "Alberta Time",
      short: "ABT"
    });
  });

  it("treats an empty options object like no options at all", () => {
    vi.stubGlobal("Temporal", PolyfillTemporal);

    expect(createHotpatch({}).toCorrectedZonedTime(edmonton)).toEqual(
      createHotpatch().toCorrectedZonedTime(edmonton)
    );
  });

  it("treats an explicit undefined temporal like omitting the option", () => {
    const hotpatch = createHotpatch({
      temporal: undefined as unknown as TemporalNamespace
    });

    vi.stubGlobal("Temporal", undefined);
    expect(() => hotpatch.toCorrectedZonedTime(edmonton)).toThrow(
      MissingTemporalError
    );

    vi.stubGlobal("Temporal", PolyfillTemporal);
    expect(hotpatch.toCorrectedZonedTime(edmonton)).toMatchObject(corrected);
  });
});
