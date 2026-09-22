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
import { inspectHostSupport } from "./inspect.js";
import type { TemporalNamespace } from "./temporal.js";
import { requireGlobalTemporal, requireTemporal } from "./temporal.js";
import type {
  CorrectedZonedTime,
  HostSupport,
  ToCorrectedInstantInput,
  ToCorrectedZonedTimeInput
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
 */
export interface Hotpatch {
  inspectHostSupport(): HostSupport;
  toCorrectedInstant(input: ToCorrectedInstantInput): CorrectedZonedTime;
  toCorrectedZonedTime(input: ToCorrectedZonedTimeInput): CorrectedZonedTime;
}

/**
 * Builds a `Hotpatch` on `options.temporal`, or on `globalThis.Temporal` when
 * it is omitted. Throws `MissingTemporalError` here when a supplied
 * implementation is unusable, so the mistake surfaces where it was made, and
 * from each call when no global one can be found.
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
    toCorrectedInstant: (input: ToCorrectedInstantInput) =>
      correct.toCorrectedInstant(temporal(), input),
    toCorrectedZonedTime: (input: ToCorrectedZonedTimeInput) =>
      correct.toCorrectedZonedTime(temporal(), input)
  });
}
