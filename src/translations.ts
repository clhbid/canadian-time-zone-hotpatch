/**
 * Approved labels for each rule, keyed by locale.
 *
 * Version 0.1 ships `en-CA` labels only. Translation configuration can only
 * add or override *labels* — it cannot alter offset rules, which are owned
 * exclusively by {@link rules}.
 */
import type { RuleId, TranslationDictionary } from "./types.js";

export const defaultTranslations: TranslationDictionary = Object.freeze({
  "en-CA": Object.freeze({
    "ab-permanent-time-2026": "Alberta Time (ABT)",
    "bc-permanent-time-2026": "Pacific Time (PCT)",
    "mb-permanent-time-2026": "Manitoba Time (MBT)"
  })
});

/** Fallback locale used when a requested locale has no translations. */
export const defaultFallbackLocale = "en-CA";

/**
 * Merges `overrides` on top of `base`, per-locale, per-rule. `overrides` wins
 * on key collisions; neither dictionary is mutated.
 */
export function mergeTranslations(
  base: TranslationDictionary,
  overrides: TranslationDictionary | undefined
): TranslationDictionary {
  if (!overrides) {
    return base;
  }
  const merged: Record<string, Record<string, string>> = {};
  for (const locale of new Set([
    ...Object.keys(base),
    ...Object.keys(overrides)
  ])) {
    merged[locale] = Object.freeze({
      ...base[locale],
      ...overrides[locale]
    }) as Record<string, string>;
  }
  return Object.freeze(merged);
}

/**
 * Resolves the approved label for `ruleId` in `locale`, falling back to
 * `fallbackLocale`, and finally to the bare `ruleId` if no label is found.
 */
export function resolveLabel(
  translations: TranslationDictionary,
  fallbackLocale: string,
  ruleId: RuleId,
  locale?: Intl.LocalesArgument
): string {
  for (const candidate of localeCandidates(locale, fallbackLocale)) {
    const label = translations[candidate]?.[ruleId];
    if (label) {
      return label;
    }
  }
  return ruleId;
}

function localeCandidates(
  locale: Intl.LocalesArgument | undefined,
  fallbackLocale: string
): string[] {
  const requested = normalizeLocaleArgument(locale);
  return [...requested, ...normalizeLocaleArgument(fallbackLocale)];
}

function normalizeLocaleArgument(
  locale: Intl.LocalesArgument | undefined
): string[] {
  if (!locale) {
    return [];
  }
  const values =
    typeof locale === "string" || locale instanceof Intl.Locale
      ? [String(locale)]
      : Array.from(locale, (entry) => String(entry));
  try {
    return Intl.getCanonicalLocales(values);
  } catch {
    return values;
  }
}
