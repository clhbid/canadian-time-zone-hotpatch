# canadian-time-zone-hotpatch

A side-effect-free Temporal adapter for correcting stale Canadian timezone data.

Browser and operating-system timezone data lag behind Canadian provincial legislation that ends
seasonal clock changes. This package owns a small, source-cited rule table for the affected zones
and tells the application whether the running host already knows those rules, by comparing the
offsets the host reports against the offsets the rules require — never by sniffing user agents,
operating systems, ICU, Temporal, or tzdata versions.

This slice ships host-support inspection. The correction API (`resolveTimeZone`,
`resolveLocalDateTime`) is defined in issue `#1` and follows in the next delivery slice.

## Usage

```ts
import { inspectTimeZoneSupport } from "@clhbid/canadian-time-zone-hotpatch";

// Does this host know the Alberta rule? Omitting `instant` probes at the
// rule's own first divergence, so the answer carries no caller bias.
inspectTimeZoneSupport({ timeZoneId: "America/Edmonton" });
// => { status: "stale", timeZoneId: "America/Edmonton",
//      ruleId: "ab-permanent-time-2026", expectedOffset: "-06:00",
//      observedOffset: "-07:00", firstDivergence: "2026-11-01T02:00:00-06:00" }

// Classify a specific instant instead.
inspectTimeZoneSupport({
  timeZoneId: "Canada/Mountain",
  instant: "2026-06-01T12:00:00Z"
});
// => { status: "current", timeZoneId: "America/Edmonton", ... }
```

`createTimeZoneHotpatch({ translations, fallbackLocale })` returns an immutable instance with the
same `inspectTimeZoneSupport` and a merged `config`. Translations supplement or override labels
per locale and rule for the upcoming resolution API; they cannot alter rules or offsets.
`defaultConfig` is the immutable built-in configuration.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run release:validate
```

`release:validate` builds the ESM output and declarations, typechecks, tests, lints, checks
formatting, and verifies the dry-run npm package. Individual checks are also available through
`npm run build`, `npm run typecheck`, `npm test`, `npm run lint`, and `npm run format`.

## Interface

```ts
inspectTimeZoneSupport(input: {
  timeZoneId: string; // canonical id or alias, matched case-insensitively
  instant?: string; // ISO 8601; omit for the rule-owned probe
}): TimeZoneSupport;

createTimeZoneHotpatch(
  config?: Partial<Pick<HotpatchConfig, "translations" | "fallbackLocale">>
): TimeZoneHotpatch;

defaultConfig: HotpatchConfig;
```

`TimeZoneSupport.status` is one of:

- `current` — the host agrees with the rule at the probed instant, or the rule has not yet
  diverged from seasonal time there, so no correction is required.
- `stale` — the host reports a legacy seasonal offset where the rule mandates a permanent one.
- `not_applicable` — a valid time zone that no rule in this package governs, including the
  unaffected B.C. regional zones `America/Dawson_Creek` and `America/Fort_Nelson`.
- `unknown` — the identifier is not a time zone the host recognizes. Inspection never throws for
  a bad identifier; a malformed `instant` throws Temporal's `RangeError`.

Governed results (`current` and `stale`) carry the canonical `timeZoneId`, `ruleId`,
`expectedOffset`, `observedOffset`, and `firstDivergence`. Those fields depend only on the host's
timezone data when `instant` is omitted, which makes them safe to aggregate as telemetry.

## Limitations

- Only `en-CA` labels are bundled.
- Fixed correction zones use IANA's inverted `Etc/GMT` signs: UTC-6 is `Etc/GMT+6`.
- The adapter reads native or polyfilled Temporal and host timezone data without changing globals.

## Rule sources

The bundled rules currently cover:

- Alberta — `America/Edmonton` / `Canada/Mountain`; [Order in Council 204/2026](https://kings-printer.alberta.ca/Documents/Orders/Orders_in_Council/2026/2026_204.html)
- British Columbia — `America/Vancouver` / `Canada/Pacific`; [Order in Council 63/2026](https://www.bclaws.gov.bc.ca/civix/document/id/oic/oic_cur/0063_2026)
- Manitoba — `America/Winnipeg` / `Canada/Central`; [The Official Time Amendment Act](https://web2.gov.mb.ca/laws/statutes/2023/c00423.php?lang=en) and the [permanent-time announcement](https://news.gov.mb.ca/news/?item=75397)

Each internal rule records its source citations. Manitoba's permanent-time change has been
announced but not yet proclaimed, so its legal commencement remains unset.

Contributor and agent workflow guidance lives in [`AGENTS.md`](./AGENTS.md).
