/**
 * `@clhbid/canadian-time-zone-hotpatch`
 *
 * A side-effect-free Temporal adapter that detects and corrects stale
 * Canadian permanent-time zone data without patching Temporal or Intl
 * globally. See the README for the interface, rule sources, and limitations.
 */
export { inspectHostSupport } from "./inspect.js";
export {
  OffsetBearingWallTimeError,
  toCorrectedInstant,
  toCorrectedZonedTime,
  UnknownTimeZoneError
} from "./correct.js";
export type {
  CorrectedZonedTime,
  Disambiguation,
  HostSupport,
  RuleId,
  TimeZoneLabel,
  TimeZoneSupport,
  TimeZoneSupportStatus,
  ToCorrectedInstantInput,
  ToCorrectedZonedTimeInput
} from "./types.js";
