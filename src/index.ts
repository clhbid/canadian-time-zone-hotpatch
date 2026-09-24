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
import * as correct from "./correct.js";
import type { Hotpatch } from "./hotpatch.js";
import {
  inspectHostSupport as inspect,
  inspectTimeZoneSupport as inspectZone
} from "./inspect.js";
import { toTimeZoneLabel as label } from "./labels.js";
import { requireGlobalTemporal } from "./temporal.js";

export { OffsetBearingWallTimeError, UnknownTimeZoneError } from "./correct.js";
export { createHotpatch } from "./hotpatch.js";
export type { Hotpatch, HotpatchOptions } from "./hotpatch.js";
export { MissingTemporalError } from "./temporal.js";
export type { TemporalNamespace } from "./temporal.js";
export { Disambiguation, TimeZoneSupportStatus } from "./types.js";
export type {
  CorrectedZonedTime,
  HostSupport,
  RuleId,
  TimeZoneLabel,
  TimeZoneSupport,
  ToCorrectedInstantInput,
  ToCorrectedZonedTimeInput,
  ToTimeZoneLabelInput
} from "./types.js";

/*
 * The default instance, equivalent to `createHotpatch()`: every call reads
 * `globalThis.Temporal` afresh, so a global installed after this module is
 * imported still counts, and throws `MissingTemporalError` when there is
 * none. They are written out here rather than destructured from a
 * module-scope `createHotpatch()` so that importing one of them does not pull
 * the others in with it.
 */

/**
 * Asks whether this host's timezone data knows the rules this package
 * patches. Throws `MissingTemporalError` when neither a global `Temporal`
 * nor one supplied to `createHotpatch` can be found.
 */
export const inspectHostSupport: Hotpatch["inspectHostSupport"] = () =>
  inspect(requireGlobalTemporal());

/**
 * Inspects a single zone's support without correcting it. No input makes it
 * throw, so it is safe to call unconditionally in a render, guarding before a
 * call to `toCorrectedZonedTime` or `toCorrectedInstant`. Throws
 * `MissingTemporalError` when neither a global `Temporal` nor one supplied to
 * `createHotpatch` can be found.
 */
export const inspectTimeZoneSupport: Hotpatch["inspectTimeZoneSupport"] = (
  timeZoneId
) => inspectZone(requireGlobalTemporal(), timeZoneId);

/**
 * Computes the instant a wall-clock reading denotes. Throws
 * `OffsetBearingWallTimeError` when the input carries a UTC offset or `Z`,
 * `UnknownTimeZoneError` for a zone the host does not recognize, and
 * Temporal's `RangeError` for a malformed wall time or, under `reject`, a
 * repeated or skipped one.
 */
export const toCorrectedInstant: Hotpatch["toCorrectedInstant"] = (input) =>
  correct.toCorrectedInstant(requireGlobalTemporal(), input);

/**
 * Corrects an instant for display; the instant itself never changes. Throws
 * `UnknownTimeZoneError` for a zone the host does not recognize — guard with
 * `inspectTimeZoneSupport` first when the identifier is not vetted — and
 * Temporal's `RangeError` for a malformed instant.
 */
export const toCorrectedZonedTime: Hotpatch["toCorrectedZonedTime"] = (input) =>
  correct.toCorrectedZonedTime(requireGlobalTemporal(), input);

/**
 * The approved label for a governed zone at an instant, or `undefined`. No
 * input makes it throw, so it is safe to call unconditionally in a render.
 */
export const toTimeZoneLabel: Hotpatch["toTimeZoneLabel"] = (input) =>
  label(requireGlobalTemporal(), input);
