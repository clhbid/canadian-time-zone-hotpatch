/**
 * `@clhbid/canadian-time-zone-hotpatch`
 *
 * A side-effect-free Temporal adapter that detects and corrects stale
 * Canadian permanent-time zone data without patching Temporal or Intl
 * globally. See the README for the interface, rule sources, and limitations.
 */
import { createTimeZoneHotpatch } from "./config.js";

export { createTimeZoneHotpatch, defaultConfig } from "./config.js";
export { inspectTimeZoneSupport } from "./inspect.js";
export {
  OffsetBearingLocalDateTimeError,
  UnknownTimeZoneError
} from "./resolve.js";
export type {
  Disambiguation,
  HotpatchConfig,
  InspectTimeZoneSupportInput,
  ResolvedLocalDateTime,
  ResolvedTimeZone,
  ResolveLocalDateTimeInput,
  ResolveTimeZoneInput,
  RuleId,
  TimeZoneHotpatch,
  TimeZoneRule,
  TimeZoneSupport,
  TimeZoneSupportStatus,
  TranslationDictionary
} from "./types.js";

const defaultHotpatch = createTimeZoneHotpatch();

/** Resolves an instant for display with the package's default configuration. */
export const resolveTimeZone = defaultHotpatch.resolveTimeZone;
/** Resolves a wall-clock time to an instant with the package's default configuration. */
export const resolveLocalDateTime = defaultHotpatch.resolveLocalDateTime;
