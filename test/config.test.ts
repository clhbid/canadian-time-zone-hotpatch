import { describe, expect, it } from "vitest";
import { createTimeZoneHotpatch, defaultConfig } from "../src/config.js";
import hotpatchDefault, {
  inspectTimeZoneSupport,
  resolveLocalDateTime,
  resolveTimeZone,
} from "../src/index.js";

describe("defaultConfig", () => {
  it("is frozen and exposes the built-in rules and en-CA translations", () => {
    expect(Object.isFrozen(defaultConfig)).toBe(true);
    expect(defaultConfig.rules).toHaveLength(3);
    expect(defaultConfig.translations["en-CA"]?.["ab-permanent-time-2026"]).toBe(
      "Alberta Time (ABT)",
    );
    expect(defaultConfig.fallbackLocale).toBe("en-CA");
  });
});

describe("default binding", () => {
  it("exposes the same functions as the default export", () => {
    expect(hotpatchDefault.inspectTimeZoneSupport).toBe(inspectTimeZoneSupport);
    expect(hotpatchDefault.resolveTimeZone).toBe(resolveTimeZone);
    expect(hotpatchDefault.resolveLocalDateTime).toBe(resolveLocalDateTime);
  });
});

describe("createTimeZoneHotpatch", () => {
  it("returns an instance with equivalent functions to the default binding", () => {
    const instance = createTimeZoneHotpatch();
    const input = { timeZoneId: "America/Edmonton", instant: "2026-11-02T12:00:00Z" };
    expect(instance.inspectTimeZoneSupport(input)).toEqual(inspectTimeZoneSupport(input));
    expect(instance.resolveTimeZone(input)).toEqual(resolveTimeZone(input));
  });

  it("allows supplementing translations without altering offset rules", () => {
    const instance = createTimeZoneHotpatch({
      translations: { "fr-CA": { "ab-permanent-time-2026": "Heure de l'Alberta (ABT)" } },
    });
    const result = instance.resolveTimeZone({
      instant: "2026-11-02T12:00:00Z",
      timeZoneId: "America/Edmonton",
      locale: "fr-CA",
    });
    expect(result.label).toBe("Heure de l'Alberta (ABT)");
    expect(result.offset).toBe("-06:00");
  });

  it("allows overriding an existing en-CA label", () => {
    const instance = createTimeZoneHotpatch({
      translations: { "en-CA": { "ab-permanent-time-2026": "Custom Alberta Label" } },
    });
    const result = instance.resolveTimeZone({
      instant: "2026-11-02T12:00:00Z",
      timeZoneId: "America/Edmonton",
    });
    expect(result.label).toBe("Custom Alberta Label");
  });

  it("does not mutate the shared default translations", () => {
    createTimeZoneHotpatch({
      translations: { "en-CA": { "ab-permanent-time-2026": "Mutated?" } },
    });
    expect(defaultConfig.translations["en-CA"]?.["ab-permanent-time-2026"]).toBe(
      "Alberta Time (ABT)",
    );
  });

  it("falls back to the configured fallbackLocale for unsupported locales", () => {
    const instance = createTimeZoneHotpatch({ fallbackLocale: "en-CA" });
    const result = instance.resolveTimeZone({
      instant: "2026-11-02T12:00:00Z",
      timeZoneId: "America/Edmonton",
      locale: "ja-JP",
    });
    expect(result.label).toBe("Alberta Time (ABT)");
  });
});
