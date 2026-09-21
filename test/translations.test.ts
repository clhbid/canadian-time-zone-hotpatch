import { describe, expect, it } from "vitest";
import {
  defaultFallbackLocale,
  defaultTranslations,
  mergeTranslations,
  resolveLabel
} from "../src/translations.js";

describe("translations", () => {
  it("returns the base dictionary unchanged when there are no overrides", () => {
    expect(mergeTranslations(defaultTranslations, undefined)).toBe(
      defaultTranslations
    );
  });

  it("merges overrides without mutating the base dictionary", () => {
    const merged = mergeTranslations(defaultTranslations, {
      "fr-CA": { "ab-permanent-time-2026": "Heure de l'Alberta" }
    });
    expect(merged["fr-CA"]?.["ab-permanent-time-2026"]).toBe(
      "Heure de l'Alberta"
    );
    expect(defaultTranslations["fr-CA"]).toBeUndefined();
  });

  it("lets an override replace an existing label for the same locale and rule", () => {
    const merged = mergeTranslations(defaultTranslations, {
      "en-CA": { "ab-permanent-time-2026": "Custom" }
    });
    expect(merged["en-CA"]?.["ab-permanent-time-2026"]).toBe("Custom");
    expect(merged["en-CA"]?.["bc-permanent-time-2026"]).toBe(
      "Pacific Time (PCT)"
    );
  });

  it("resolves a label for a supported locale", () => {
    const label = resolveLabel(
      defaultTranslations,
      defaultFallbackLocale,
      "ab-permanent-time-2026",
      "en-CA"
    );
    expect(label).toBe("Alberta Time (ABT)");
  });

  it("falls back to the fallback locale when the requested locale is unsupported", () => {
    const label = resolveLabel(
      defaultTranslations,
      defaultFallbackLocale,
      "ab-permanent-time-2026",
      "ja-JP"
    );
    expect(label).toBe("Alberta Time (ABT)");
  });

  it("canonicalizes requested locale casing before lookup", () => {
    const label = resolveLabel(
      {
        ...defaultTranslations,
        "fr-CA": { "ab-permanent-time-2026": "Heure de l'Alberta" }
      },
      defaultFallbackLocale,
      "ab-permanent-time-2026",
      "fr-ca"
    );
    expect(label).toBe("Heure de l'Alberta");
  });

  it("canonicalizes fallback locale casing before lookup", () => {
    const label = resolveLabel(
      defaultTranslations,
      "en-ca",
      "ab-permanent-time-2026",
      "ja-jp"
    );
    expect(label).toBe("Alberta Time (ABT)");
  });

  it("falls back to the bare rule id when no label exists anywhere", () => {
    const label = resolveLabel(
      {},
      defaultFallbackLocale,
      "ab-permanent-time-2026",
      "en-CA"
    );
    expect(label).toBe("ab-permanent-time-2026");
  });

  it("accepts an Intl.Locale instance", () => {
    const label = resolveLabel(
      defaultTranslations,
      defaultFallbackLocale,
      "ab-permanent-time-2026",
      new Intl.Locale("en-CA")
    );
    expect(label).toBe("Alberta Time (ABT)");
  });

  it("tries requested locales in order", () => {
    const label = resolveLabel(
      defaultTranslations,
      defaultFallbackLocale,
      "ab-permanent-time-2026",
      ["fr-CA", "en-CA"]
    );
    expect(label).toBe("Alberta Time (ABT)");
  });

  it("falls back when the requested locale is malformed", () => {
    const label = resolveLabel(
      defaultTranslations,
      defaultFallbackLocale,
      "ab-permanent-time-2026",
      "not_a_locale"
    );
    expect(label).toBe("Alberta Time (ABT)");
  });

  it("ignores malformed requested locales without discarding later valid locales", () => {
    const label = resolveLabel(
      {
        ...defaultTranslations,
        "fr-CA": { "ab-permanent-time-2026": "Heure de l'Alberta" }
      },
      defaultFallbackLocale,
      "ab-permanent-time-2026",
      ["not_a_locale", "fr-ca"]
    );
    expect(label).toBe("Heure de l'Alberta");
  });
});
