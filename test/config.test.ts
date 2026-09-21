import { describe, expect, it } from "vitest";
import {
  createTimeZoneHotpatch,
  defaultConfig,
  inspectTimeZoneSupport
} from "../src/index.js";
import { rules } from "../src/rules.js";
import { defaultTranslations } from "../src/translations.js";

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
        "fr-CA": { "ab-permanent-time-2026": "Heure de l'Alberta" }
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
        "fr-CA": { "ab-permanent-time-2026": "Heure de l'Alberta" }
      }
    });
    expect(config.translations["fr-CA"]?.["ab-permanent-time-2026"]).toBe(
      "Heure de l'Alberta"
    );
    expect(config.translations["en-CA"]).toEqual(defaultTranslations["en-CA"]);
  });

  it("overrides a built-in label without touching the others", () => {
    const { config } = createTimeZoneHotpatch({
      translations: { "en-CA": { "ab-permanent-time-2026": "Custom" } }
    });
    expect(config.translations["en-CA"]?.["ab-permanent-time-2026"]).toBe(
      "Custom"
    );
    expect(config.translations["en-CA"]?.["bc-permanent-time-2026"]).toBe(
      "Pacific Time (PCT)"
    );
  });

  it("replaces the fallback locale", () => {
    expect(
      createTimeZoneHotpatch({ fallbackLocale: "fr-CA" }).config.fallbackLocale
    ).toBe("fr-CA");
  });

  it("never mutates the default configuration", () => {
    createTimeZoneHotpatch({
      translations: { "en-CA": { "ab-permanent-time-2026": "Mutated?" } },
      fallbackLocale: "fr-CA"
    });
    expect(
      defaultConfig.translations["en-CA"]?.["ab-permanent-time-2026"]
    ).toBe("Alberta Time (ABT)");
    expect(defaultConfig.fallbackLocale).toBe("en-CA");
  });

  it("cannot alter rules or offsets", () => {
    const { config } = createTimeZoneHotpatch({
      // @ts-expect-error rules are not configurable
      rules: [],
      translations: { "en-CA": { "ab-permanent-time-2026": "Custom" } }
    });
    expect(config.rules).toBe(rules);
  });
});
