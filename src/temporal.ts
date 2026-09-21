/**
 * Resolves the Temporal implementation to use internally.
 *
 * Prefers a native `Temporal` global when the host provides one, and falls
 * back to `temporal-polyfill` otherwise. This module never assigns to
 * `globalThis.Temporal` (or any other global) — it only reads a value that
 * may already be there.
 */
import { Temporal as PolyfillTemporal } from "temporal-polyfill";

type TemporalNamespace = typeof PolyfillTemporal;

function readGlobalTemporal(): TemporalNamespace | undefined {
  const candidate = (globalThis as { Temporal?: unknown }).Temporal;
  if (
    candidate &&
    typeof candidate === "object" &&
    "Instant" in candidate &&
    "ZonedDateTime" in candidate
  ) {
    return candidate as TemporalNamespace;
  }
  return undefined;
}

export const Temporal: TemporalNamespace =
  readGlobalTemporal() ?? PolyfillTemporal;
