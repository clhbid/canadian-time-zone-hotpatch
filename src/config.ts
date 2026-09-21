/**
 * Factory for creating configured `TimeZoneHotpatch` instances, and the
 * package's immutable default configuration.
 */
import { rules } from "./rules.js";
import { defaultFallbackLocale, defaultTranslations, mergeTranslations } from "./translations.js";
import { inspectTimeZoneSupport as inspect } from "./inspect.js";
import {
  resolveLocalDateTime as resolveLocal,
  resolveTimeZone as resolveInstant,
} from "./resolve.js";
import type {
  HotpatchConfig,
  InspectTimeZoneSupportInput,
  ResolveLocalDateTimeInput,
  ResolveTimeZoneInput,
  TimeZoneHotpatch,
} from "./types.js";

/** The package's immutable default configuration: all built-in rules and `en-CA` labels. */
export const defaultConfig: HotpatchConfig = Object.freeze({
  rules,
  translations: defaultTranslations,
  fallbackLocale: defaultFallbackLocale,
});

/**
 * Creates a `TimeZoneHotpatch` instance. Rules are always the package's
 * built-in, source-cited set — only translations and the fallback locale may
 * be supplemented or replaced. Configuration never alters offset rules.
 */
export function createTimeZoneHotpatch(
  config?: Partial<Pick<HotpatchConfig, "translations" | "fallbackLocale">>,
): TimeZoneHotpatch {
  const translations = mergeTranslations(defaultTranslations, config?.translations);
  const fallbackLocale = config?.fallbackLocale ?? defaultFallbackLocale;

  return Object.freeze({
    inspectTimeZoneSupport(input: InspectTimeZoneSupportInput) {
      return inspect(input);
    },
    resolveTimeZone(input: ResolveTimeZoneInput) {
      return resolveInstant(translations, fallbackLocale, input);
    },
    resolveLocalDateTime(input: ResolveLocalDateTimeInput) {
      return resolveLocal(translations, fallbackLocale, input);
    },
  });
}
