import { describe, expect, it } from "vitest";
import {
  createTimeZoneHotpatch,
  defaultConfig,
  inspectTimeZoneSupport,
  resolveLocalDateTime,
  resolveTimeZone
} from "../src/index.js";
import { rules } from "../src/rules.js";
import { defaultTranslations } from "../src/translations.js";

/** An instant after Alberta's first divergence, when a stale host needs correction. */
const afterDivergence = {
  instant: "2026-11-02T12:00:00Z",
  timeZoneId: "America/Edmonton"
} as const;

describe("defaultConfig", () => {
  it("holds the built-in rules, en-CA labels, and en-CA fallback", () => {
    expect(defaultConfig).toEqual({
      rules,
      translations: defaultTranslations,
      fallbackLocale: "en-CA"
    });
  });

  it("is frozen", () => {
    expect(Object.isFrozen(defaultConfig)).toBe(true);
    expect(Object.isFrozen(defaultConfig.rules)).toBe(true);
    expect(Object.isFrozen(defaultConfig.translations)).toBe(true);
  });
});

describe("createTimeZoneHotpatch", () => {
  it("defaults to the default configuration", () => {
    expect(createTimeZoneHotpatch().config).toEqual(defaultConfig);
  });

  it("returns a frozen instance with frozen configuration", () => {
    const instance = createTimeZoneHotpatch({
      translations: {
        "fr-CA": {
          "ab-permanent-time-2026": { long: "Heure de l'Alberta", short: "HA" }
        }
      }
    });
    expect(Object.isFrozen(instance)).toBe(true);
    expect(Object.isFrozen(instance.config)).toBe(true);
    expect(Object.isFrozen(instance.config.translations)).toBe(true);
    expect(Object.isFrozen(instance.config.translations["fr-CA"])).toBe(true);
  });

  it("exposes the same inspection as the package root", () => {
    expect(createTimeZoneHotpatch().inspectTimeZoneSupport).toBe(
      inspectTimeZoneSupport
    );
  });

  it("supplements translations with a new locale", () => {
    const { config } = createTimeZoneHotpatch({
      translations: {
        "fr-CA": {
          "ab-permanent-time-2026": { long: "Heure de l'Alberta", short: "HA" }
        }
      }
    });
    expect(config.translations["fr-CA"]?.["ab-permanent-time-2026"]).toEqual({
      long: "Heure de l'Alberta",
      short: "HA"
    });
    expect(config.translations["en-CA"]).toEqual(defaultTranslations["en-CA"]);
  });

  it("overrides a built-in label without touching the others", () => {
    const { config } = createTimeZoneHotpatch({
      translations: {
        "en-CA": { "ab-permanent-time-2026": { long: "Custom", short: "C" } }
      }
    });
    expect(config.translations["en-CA"]?.["ab-permanent-time-2026"]).toEqual({
      long: "Custom",
      short: "C"
    });
    expect(config.translations["en-CA"]?.["bc-permanent-time-2026"]).toEqual({
      long: "Pacific Time",
      short: "PCT"
    });
  });

  it("replaces the fallback locale", () => {
    expect(
      createTimeZoneHotpatch({ fallbackLocale: "fr-CA" }).config.fallbackLocale
    ).toBe("fr-CA");
  });

  it("never mutates the default configuration", () => {
    createTimeZoneHotpatch({
      translations: {
        "en-CA": { "ab-permanent-time-2026": { long: "Mutated?", short: "M?" } }
      },
      fallbackLocale: "fr-CA"
    });
    expect(
      defaultConfig.translations["en-CA"]?.["ab-permanent-time-2026"]
    ).toEqual({ long: "Alberta Time", short: "ABT" });
    expect(defaultConfig.fallbackLocale).toBe("en-CA");
  });

  it("resolves with the same results as the package root", () => {
    const instance = createTimeZoneHotpatch();
    const local = {
      localDateTime: "2026-11-02T12:00:00",
      timeZoneId: "America/Edmonton",
      disambiguation: "compatible"
    } as const;
    expect(instance.resolveTimeZone(afterDivergence)).toEqual(
      resolveTimeZone(afterDivergence)
    );
    expect(instance.resolveLocalDateTime(local)).toEqual(
      resolveLocalDateTime(local)
    );
  });

  it("labels results with supplemented and overridden translations", () => {
    const instance = createTimeZoneHotpatch({
      translations: {
        "fr-CA": {
          "ab-permanent-time-2026": { long: "Heure de l'Alberta", short: "HA" }
        },
        "en-CA": {
          "bc-permanent-time-2026": { long: "B.C. Time", short: "BCT" }
        }
      }
    });
    expect(
      instance.resolveTimeZone({ ...afterDivergence, locale: "fr-CA" }).label
    ).toEqual({ long: "Heure de l'Alberta", short: "HA" });
    expect(instance.resolveTimeZone(afterDivergence).label).toEqual({
      long: "Alberta Time",
      short: "ABT"
    });
    expect(
      instance.resolveLocalDateTime({
        localDateTime: "2026-11-02T12:00:00",
        timeZoneId: "America/Vancouver",
        disambiguation: "compatible",
        locale: ["ja-JP", "en-CA"]
      }).label
    ).toEqual({ long: "B.C. Time", short: "BCT" });
    expect(
      resolveTimeZone({ ...afterDivergence, locale: "fr-CA" }).label
    ).toEqual({ long: "Alberta Time", short: "ABT" });
  });

  it("labels through the configured fallback locale", () => {
    const instance = createTimeZoneHotpatch({
      translations: {
        "fr-CA": {
          "ab-permanent-time-2026": { long: "Heure de l'Alberta", short: "HA" }
        }
      },
      fallbackLocale: "fr-CA"
    });
    expect(
      instance.resolveTimeZone({ ...afterDivergence, locale: "ja-JP" }).label
    ).toEqual({ long: "Heure de l'Alberta", short: "HA" });
  });

  it("cannot alter rules or offsets", () => {
    const instance = createTimeZoneHotpatch({
      // @ts-expect-error rules are not configurable
      rules: [],
      translations: {
        "en-CA": { "ab-permanent-time-2026": { long: "Custom", short: "C" } }
      }
    });
    expect(instance.config.rules).toBe(rules);
    expect(instance.resolveTimeZone(afterDivergence).offset).toBe("-06:00");
  });
});
