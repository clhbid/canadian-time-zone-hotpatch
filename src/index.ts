/**
 * `@clhbid/canadian-time-zone-hotpatch`
 *
 * A side-effect-free Temporal adapter that detects stale Canadian
 * permanent-time zone data without patching Temporal or Intl globally. See
 * the README for the interface, rule sources, and limitations.
 */
export { createTimeZoneHotpatch, defaultConfig } from "./config.js";
export { inspectTimeZoneSupport } from "./inspect.js";
export type {
  HotpatchConfig,
  InspectTimeZoneSupportInput,
  RuleId,
  TimeZoneHotpatch,
  TimeZoneRule,
  TimeZoneSupport,
  TimeZoneSupportStatus,
  TranslationDictionary
} from "./types.js";
