/**
 * The named constructor that binds the package's functions to one Temporal
 * implementation.
 *
 * A caller who has a `Temporal` but has not installed it globally — the usual
 * case on Node, and in any browser app importing a polyfill as a module —
 * passes it here instead of patching a global. Omitting it defers to
 * `globalThis.Temporal`, read afresh on every call so that a global installed
 * after this module is imported still counts.
 */
import * as correct from "./correct.js";
import { inspectHostSupport, inspectTimeZoneSupport } from "./inspect.js";
import { toTimeZoneLabel } from "./labels.js";
import type { TemporalNamespace } from "./temporal.js";
import { requireGlobalTemporal, requireTemporal } from "./temporal.js";
import type {
  CorrectedZonedTime,
  HostSupport,
  TimeZoneLabel,
  TimeZoneSupport,
  ToCorrectedInstantInput,
  ToCorrectedZonedTimeInput,
  ToTimeZoneLabelInput
} from "./types.js";

/** Options for `createHotpatch`. */
export interface HotpatchOptions {
  /**
   * The `Temporal` implementation to run on. Omit it to read
   * `globalThis.Temporal` on every call.
   */
  readonly temporal?: TemporalNamespace;
}

/**
 * The package's functions bound to one Temporal implementation. The error
 * classes stay top-level exports: they are matched with `instanceof` and are
 * never rebound per instance.
 *
 * Each member repeats its top-level counterpart's doc comment, pinned by
 * `test/doc-comment-parity.test.ts`.
 */
export interface Hotpatch {
  /**
   * Asks whether this host's timezone data knows the rules this package
   * patches. `ruleSupport` carries every rule's own status, in rule-table
   * order, so a caller can report telemetry per rule without joining
   * `staleRuleIds` against the exported `rules` table.
   * @throws {MissingTemporalError} When no Temporal implementation is available.
   */
  inspectHostSupport(): HostSupport;

  /**
   * Inspects a single zone's support without correcting it. No input makes it
   * throw, so it is safe to call unconditionally in a render, guarding before a
   * call to `toCorrectedZonedTime` or `toCorrectedInstant`.
   * @throws {MissingTemporalError} When no Temporal implementation is available.
   */
  inspectTimeZoneSupport(timeZoneId: string): TimeZoneSupport;

  /**
   * Computes the instant a wall-clock reading denotes.
   * @throws {MissingTemporalError} When no Temporal implementation is available.
   * @throws {OffsetBearingWallTimeError} When `wallTime` carries a UTC offset or `Z`.
   * @throws {UnknownTimeZoneError} When the host does not recognize `timeZoneId`.
   * @throws {RangeError} When `wallTime` is malformed, or under `reject`, denotes a repeated or skipped time.
   */
  toCorrectedInstant(input: ToCorrectedInstantInput): CorrectedZonedTime;

  /**
   * Corrects an instant for display; the instant itself never changes. Guard
   * with `inspectTimeZoneSupport` first when `timeZoneId` is not vetted.
   * @throws {MissingTemporalError} When no Temporal implementation is available.
   * @throws {UnknownTimeZoneError} When the host does not recognize `timeZoneId`.
   * @throws {RangeError} When `instant` is malformed.
   */
  toCorrectedZonedTime(input: ToCorrectedZonedTimeInput): CorrectedZonedTime;

  /**
   * The approved label for a governed zone at an instant, or `undefined`. No
   * input makes it throw, so it is safe to call unconditionally in a render.
   * @throws {MissingTemporalError} When no Temporal implementation is available.
   */
  toTimeZoneLabel(input: ToTimeZoneLabelInput): TimeZoneLabel | undefined;
}

/**
 * Builds a `Hotpatch` on `options.temporal`, or on `globalThis.Temporal` when
 * it is omitted. A supplied implementation is checked here rather than at
 * first use, so the mistake surfaces where it was made; a missing global one
 * surfaces from each call instead.
 * @throws {MissingTemporalError} When `options.temporal` is not a usable
 * Temporal implementation.
 */
export function createHotpatch(options: HotpatchOptions = {}): Hotpatch {
  // Reading the global here would make importing this package inspect the
  // host, so the global case stays deferred to the call.
  const supplied =
    options.temporal === undefined
      ? undefined
      : requireTemporal(options.temporal);
  const temporal = (): TemporalNamespace => supplied ?? requireGlobalTemporal();

  return Object.freeze({
    inspectHostSupport: () => inspectHostSupport(temporal()),
    inspectTimeZoneSupport: (timeZoneId: string) =>
      inspectTimeZoneSupport(temporal(), timeZoneId),
    toCorrectedInstant: (input: ToCorrectedInstantInput) =>
      correct.toCorrectedInstant(temporal(), input),
    toCorrectedZonedTime: (input: ToCorrectedZonedTimeInput) =>
      correct.toCorrectedZonedTime(temporal(), input),
    toTimeZoneLabel: (input: ToTimeZoneLabelInput) =>
      toTimeZoneLabel(temporal(), input)
  });
}
