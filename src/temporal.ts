/**
 * The Temporal implementation the package runs on.
 *
 * This package supplies no implementation of its own: a compatible
 * `Temporal` comes from the host's own global or from the caller, through
 * `createHotpatch({ temporal })`. Nothing here ever assigns to
 * `globalThis.Temporal` (or any other global) — the global is only read.
 */
import type { Temporal } from "temporal-spec";

/** A `Temporal` namespace, native or polyfilled, this package can run on. */
export type TemporalNamespace = typeof Temporal;

/** Thrown when no compatible `Temporal` implementation is available. */
export class MissingTemporalError extends TypeError {
  constructor() {
    super(
      "No compatible Temporal implementation is available. Either provide a " +
        "global Temporal (for example by installing a polyfill globally), or " +
        "pass one to createHotpatch({ temporal })."
    );
    this.name = "MissingTemporalError";
  }
}

/** The statics this package calls; a candidate missing any of them is not usable. */
const requiredStatics: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    Instant: ["from", "fromEpochMilliseconds", "compare"],
    PlainDateTime: ["from"],
    PlainDate: ["from", "compare"]
  });

/** Whether `candidate` exposes every Temporal static this package calls. */
function isTemporalNamespace(
  candidate: unknown
): candidate is TemporalNamespace {
  if (typeof candidate !== "object" || candidate === null) {
    return false;
  }
  const namespace = candidate as Record<string, Record<string, unknown>>;
  return Object.entries(requiredStatics).every(([name, statics]) =>
    // A constructor is a function, but a namespace object stands in equally;
    // only the statics actually called have to be there.
    statics.every((member) => typeof namespace[name]?.[member] === "function")
  );
}

/** Validates `candidate`, throwing `MissingTemporalError` when it is unusable. */
export function requireTemporal(candidate: unknown): TemporalNamespace {
  if (!isTemporalNamespace(candidate)) {
    throw new MissingTemporalError();
  }
  return candidate;
}

/**
 * The host's own `globalThis.Temporal`. Read on every call, so a global
 * installed after this module is imported is still picked up.
 */
export function requireGlobalTemporal(): TemporalNamespace {
  return requireTemporal((globalThis as { Temporal?: unknown }).Temporal);
}
