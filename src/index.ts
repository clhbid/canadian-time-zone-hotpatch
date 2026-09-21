/**
 * Public package foundation. Runtime inspection and resolution are added by
 * the subsequent delivery slices tracked under issue #1.
 */
export type { RuleCitation, TimeZoneRule, TranslationDictionary } from "./types.js";

export { rules } from "./rules.js";
export {
  defaultFallbackLocale,
  defaultTranslations,
  mergeTranslations,
} from "./translations.js";
