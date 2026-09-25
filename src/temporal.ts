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

/** Every static this package calls; a candidate missing any of them is unusable. */
const requiredStatics: readonly string[] = [
  "Instant.from",
  "Instant.fromEpochMilliseconds",
  "Instant.compare",
  "PlainDateTime.from",
  "PlainDate.from",
  "PlainDate.compare"
];

/** Whether `candidate` exposes every Temporal static this package calls. */
function isTemporalNamespace(
  candidate: unknown
): candidate is TemporalNamespace {
  if (typeof candidate !== "object" || candidate === null) {
    return false;
  }
  const namespace = candidate as Record<string, Record<string, unknown>>;
  const hasRequiredStatics = requiredStatics.every((path) => {
    const [name, member] = path.split(".") as [string, string];
    return typeof namespace[name]?.[member] === "function";
  });
  if (!hasRequiredStatics) {
    return false;
  }
  // Required for rule_outdated detection: every native Temporal has it, and
  // it has shipped in temporal-polyfill since 0.3.0 and @js-temporal/polyfill
  // since 0.5.0. There is no fallback for an implementation without it.
  const zonedDateTimePrototype = (
    namespace.ZonedDateTime as { prototype?: Record<string, unknown> }
  )?.prototype;
  return typeof zonedDateTimePrototype?.getTimeZoneTransition === "function";
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
