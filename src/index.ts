/**
 * `@clhbid/canadian-time-zone-hotpatch`
 *
 * A side-effect-free Temporal adapter that detects and corrects stale
 * Canadian permanent-time zone data without patching Temporal or Intl
 * globally. See the README for interface details, citations and limitations.
 */
export type {
  Disambiguation,
  HotpatchConfig,
  InspectTimeZoneSupportInput,
  ResolveLocalDateTimeInput,
  ResolveTimeZoneInput,
  ResolvedLocalDateTime,
  ResolvedTimeZone,
  RuleCitation,
  TimeZoneHotpatch,
  TimeZoneRule,
  TimeZoneSupport,
  TimeZoneSupportStatus,
  TranslationDictionary,
} from "./types.js";

export { rules } from "./rules.js";
export { defaultTranslations, defaultFallbackLocale, mergeTranslations } from "./translations.js";
export { UnknownTimeZoneError, OffsetBearingLocalDateTimeError } from "./resolve.js";
export { createTimeZoneHotpatch, defaultConfig } from "./config.js";

import { createTimeZoneHotpatch } from "./config.js";

const defaultHotpatch = createTimeZoneHotpatch();

export const inspectTimeZoneSupport = defaultHotpatch.inspectTimeZoneSupport;
export const resolveTimeZone = defaultHotpatch.resolveTimeZone;
export const resolveLocalDateTime = defaultHotpatch.resolveLocalDateTime;

export default defaultHotpatch;
