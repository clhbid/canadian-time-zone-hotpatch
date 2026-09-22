/**
 * Approved English labels for each rule.
 *
 * Version 0.1 ships these `long` and `short` forms only; labels cannot alter
 * offset rules, which are owned exclusively by `src/rules.ts`.
 */
import type { RuleId, TimeZoneLabel } from "./types.js";

export const labels: Readonly<Record<RuleId, TimeZoneLabel>> = Object.freeze({
  "ab-permanent-time-2026": Object.freeze({
    long: "Alberta Time",
    short: "ABT"
  }),
  "bc-permanent-time-2026": Object.freeze({
    long: "Pacific Time",
    short: "PCT"
  }),
  "mb-permanent-time-2026": Object.freeze({
    long: "Manitoba Time",
    short: "MBT"
  })
});
