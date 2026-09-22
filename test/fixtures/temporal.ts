/**
 * The Temporal implementation the behaviour suites run on.
 *
 * It is supplied to `createHotpatch` explicitly rather than installed on
 * `globalThis`: with a global Temporal present for the whole run, code that
 * ignored its supplied namespace and read the global instead would still
 * pass.
 */
import { Temporal } from "temporal-polyfill";
import { createHotpatch } from "../../src/hotpatch.js";
import type { TemporalNamespace } from "../../src/temporal.js";

export const temporal: TemporalNamespace = Temporal;

/** A hotpatch bound to `temporal`, for suites that exercise the public functions. */
export const hotpatch = createHotpatch({ temporal });
