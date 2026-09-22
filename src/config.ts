/**
 * The package's immutable default configuration, and the factory for
 * instances configured with supplementary translations.
 */
import { inspectTimeZoneSupport } from "./inspect.js";
import { resolveLocalDateTime, resolveTimeZone } from "./resolve.js";
import { rules } from "./rules.js";
import {
  defaultFallbackLocale,
  defaultTranslations,
  mergeTranslations
} from "./translations.js";
import type {
  HotpatchConfig,
  ResolveLocalDateTimeInput,
  ResolveTimeZoneInput,
  TimeZoneHotpatch
} from "./types.js";

/** Built-in rules, approved `en-CA` labels, and the `en-CA` fallback. */
export const defaultConfig: HotpatchConfig = Object.freeze({
  rules,
  translations: defaultTranslations,
  fallbackLocale: defaultFallbackLocale
});

/**
 * Creates an immutable instance. Translations supplement or override the
 * defaults per locale and rule, and the fallback locale may be replaced;
 * rules and offsets are always the package's built-in set.
 */
export function createTimeZoneHotpatch(
  config?: Partial<Pick<HotpatchConfig, "translations" | "fallbackLocale">>
): TimeZoneHotpatch {
  const merged: HotpatchConfig = Object.freeze({
    rules: defaultConfig.rules,
    translations: mergeTranslations(
      defaultConfig.translations,
      config?.translations
    ),
    fallbackLocale: config?.fallbackLocale ?? defaultConfig.fallbackLocale
  });
  return Object.freeze({
    config: merged,
    inspectTimeZoneSupport,
    resolveTimeZone: (input: ResolveTimeZoneInput) =>
      resolveTimeZone(merged, input),
    resolveLocalDateTime: (input: ResolveLocalDateTimeInput) =>
      resolveLocalDateTime(merged, input)
  });
}
