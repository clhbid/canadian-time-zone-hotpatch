/**
 * `@clhbid/canadian-time-zone-hotpatch`
 *
 * A side-effect-free Temporal adapter that detects and corrects stale
 * Canadian permanent-time zone data without patching Temporal or Intl
 * globally. See the README for the interface, rule sources, and limitations.
 *
 * A compatible `Temporal` implementation is required. The functions exported
 * here read `globalThis.Temporal` on every call; a caller without a global
 * one supplies their own through `createHotpatch`.
 */
import { createHotpatch } from "./hotpatch.js";

export { OffsetBearingWallTimeError, UnknownTimeZoneError } from "./correct.js";
export { createHotpatch } from "./hotpatch.js";
export type { Hotpatch, HotpatchOptions } from "./hotpatch.js";
export { MissingTemporalError } from "./temporal.js";
export type { TemporalNamespace } from "./temporal.js";
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

/** The default instance, bound to whatever `globalThis.Temporal` holds at call time. */
export const { inspectHostSupport, toCorrectedInstant, toCorrectedZonedTime } =
  createHotpatch();
