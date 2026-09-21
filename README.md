# canadian-time-zone-hotpatch

`@clhbid/canadian-time-zone-hotpatch` is a public, side-effect-free ESM/TypeScript package that
detects stale Canadian permanent-time zone data on the host running it, and corrects both
instant-to-display and wall-time-to-instant calculations — without ever patching `Temporal`,
`Intl`, or any built-in prototype globally.

It exists because browser and OS time zone databases (the IANA tz database, as surfaced through
`Intl`) lag behind Canadian provincial legislation that ends seasonal clock changes. This package
owns a small, versioned, source-cited rule table for the affected zones and applies corrections
only when — and only where — its own detection logic determines they're needed.

## Why this exists

Both CLHbid applications need one independently versioned package to:

- **Detect** whether the host's own time zone data already reflects a legislated permanent offset,
  or is still stale (without user-agent/version sniffing — only observed offsets).
- **Correct** instants (`resolveTimeZone`) and local wall-clock input (`resolveLocalDateTime`) the
  same way, on top of either native `Temporal` or [`temporal-polyfill`](https://www.npmjs.com/package/temporal-polyfill).
- **Label** the result with an approved, versioned, translatable name — without ever silently
  guessing a jurisdiction for unrecognized input.

## Install

```bash
npm install @clhbid/canadian-time-zone-hotpatch
```

`temporal-polyfill` is a direct dependency and is used automatically whenever the host doesn't
already expose a `Temporal` global; this package never assigns to `globalThis.Temporal` (or any
other global) itself.

## Usage

```ts
import {
  inspectTimeZoneSupport,
  resolveTimeZone,
  resolveLocalDateTime,
} from "@clhbid/canadian-time-zone-hotpatch";

// Is the host's own America/Edmonton data up to date?
inspectTimeZoneSupport({ timeZoneId: "America/Edmonton" });
// => { status: "stale", ruleId: "ab-permanent-time-2026", ruleVersion: "1",
//      expectedOffset: "-06:00", observedOffset: "-07:00",
//      firstDivergence: "2026-11-01T02:00:00-06:00", timeZoneId: "America/Edmonton" }

// Correct an instant for display.
resolveTimeZone({ instant: "2026-11-15T12:00:00Z", timeZoneId: "America/Edmonton" });
// => { instant: "2026-11-15T12:00:00Z", timeZoneId: "Etc/GMT+6", offset: "-06:00",
//      label: "Alberta Time (ABT)", support: { status: "stale", ... } }

// Resolve a local wall-clock date-time to the legislated instant.
resolveLocalDateTime({
  localDateTime: "2026-11-01T01:30:00",
  timeZoneId: "America/Edmonton",
  disambiguation: "compatible",
});
// => { instant: "2026-11-01T07:30:00Z", timeZoneId: "Etc/GMT+6", offset: "-06:00", ... }
```

The same three functions are available as instance methods from a configured instance:

```ts
import { createTimeZoneHotpatch } from "@clhbid/canadian-time-zone-hotpatch";

const hotpatch = createTimeZoneHotpatch({
  translations: { "fr-CA": { "ab-permanent-time-2026": "Heure de l'Alberta (ABT)" } },
});

hotpatch.resolveTimeZone({
  instant: "2026-11-15T12:00:00Z",
  timeZoneId: "America/Edmonton",
  locale: "fr-CA",
});
```

## Interface

```ts
inspectTimeZoneSupport(input: {
  timeZoneId: string;
  instant?: string; // omit for an unbiased, rule-owned probe (telemetry-safe)
}): TimeZoneSupport;

resolveTimeZone(input: {
  instant: string;
  timeZoneId: string;
  locale?: Intl.LocalesArgument;
}): ResolvedTimeZone;

resolveLocalDateTime(input: {
  localDateTime: string; // wall-clock only: a UTC offset or "Z" is rejected
  timeZoneId: string;
  disambiguation: "compatible" | "earlier" | "later" | "reject";
  locale?: Intl.LocalesArgument;
}): ResolvedLocalDateTime;
```

`TimeZoneSupport.status` is one of:

- `current` — the host already agrees with the rule (or the rule doesn't apply yet at the probed
  instant).
- `stale` — the host reports a legacy seasonal offset where the rule mandates a permanent one.
- `not_applicable` — a valid, recognized time zone that isn't governed by any rule here.
- `unknown` — the identifier could not be recognized as a valid time zone at all.

`inspectTimeZoneSupport`/`resolveTimeZone`/`resolveLocalDateTime` never sniff the user agent or a
version string — support is always determined from observed offsets. A correction is applied only
when the host's own data is `stale`: on a host whose tzdata already knows a rule, both resolvers
keep the canonical named zone. Resolution throws (`UnknownTimeZoneError`,
`OffsetBearingLocalDateTimeError` for a local date-time carrying a UTC offset or `Z`, or a native
`RangeError` for malformed instants and for `disambiguation: "reject"`) rather than silently
choosing a jurisdiction — or an instant — for input it can't recognize.

## Governed rules (source-cited)

| Jurisdiction     | Canonical zone      | Aliases           | Permanent offset | Label               |
| ---------------- | ------------------- | ----------------- | ---------------- | ------------------- |
| Alberta          | `America/Edmonton`  | `Canada/Mountain` | `-06:00` (ABT)   | Alberta Time (ABT)  |
| British Columbia | `America/Vancouver` | `Canada/Pacific`  | `-07:00` (PCT)   | Pacific Time (PCT)  |
| Manitoba         | `America/Winnipeg`  | `Canada/Central`  | `-05:00` (MBT)   | Manitoba Time (MBT) |

Each rule models a `legalEffectiveInstant` (when the legislated offset legally commences — not when
the legislation received Royal Assent or was announced) and a
`firstDivergenceInstant` (the first wall-clock moment a legacy, un-patched host's seasonal data
would diverge from the legislated offset — typically the next scheduled "fall back") separately.
Sources:

- Alberta — [Official Time Regulation (Alta. Reg. 136/2026)](https://open.alberta.ca/publications/official-time-regulation),
  [Alberta Is Set to Adopt Permanent Daylight Saving Time](https://www.timeanddate.com/news/time/alberta-permanent-dst.html),
  [Alberta Time Is Official: Bill 31 Ends Clock Changes](https://www.culturealberta.com/articles/alberta-time-is-official-bill-31-ends-clock-changes-for-good-in-alberta)
- British Columbia — [BC Adopts Permanent Daylight Saving Time](https://www.timeanddate.com/news/time/canada-bc-permanent-dst.html),
  [Province of British Columbia](https://www2.gov.bc.ca/gov/content/governments/celebrating-british-columbia/daylight-saving-time)
- Manitoba — [CBC: Manitoba adopts permanent daylight time](https://www.cbc.ca/news/canada/manitoba/daylight-time-manitoba-9.7347844),
  [Manitoba Will Move to Permanent Daylight Time](https://news.gov.mb.ca/news/?item=75397)

Other B.C. regional zones that remain on permanent standard time year-round (`America/Dawson_Creek`,
`America/Fort_Nelson`) are **not** affected by the B.C. rule above and report `not_applicable`.

## Limitations & ownership

- This package is **not** a general time zone database or a replacement for the IANA tz database —
  it only corrects the specific, legislated Canadian permanent-time changes it knows about.
- It does not perform application-specific date formatting/layout, analytics, or French
  translations in this `0.1` release (English labels only; French can be supplied via
  `createTimeZoneHotpatch({ translations })`).
- It never mutates `globalThis.Temporal`, `Intl`, or any built-in prototype.
- Ownership of the rule table lives in this repository; changes to offsets or effective/divergence
  instants must bump the affected rule's `ruleVersion` and cite a source.

## Rule versioning & deprecation

Each `TimeZoneRule` carries its own `ruleId` (stable) and `ruleVersion` (bumped whenever its offset,
effective instant, or divergence instant changes). Consumers that persist `TimeZoneSupport` results
for telemetry should key on `ruleId` + `ruleVersion` together. When a jurisdiction's host data has
been broadly patched for long enough that a rule is no longer expected to diverge in practice, the
rule will be marked deprecated in this README ahead of removal in a subsequent major version; it
will not be silently deleted.

## Translation configuration

`defaultConfig.translations` ships approved `en-CA` labels only. `createTimeZoneHotpatch({
translations, fallbackLocale })` lets consumers supplement or override labels per locale and rule
id; translation configuration can only change _labels_ — it cannot alter any rule's offset, its
canonical/fixed time zone identifiers, or its effective/divergence instants.

## Telemetry-safe fields

Calling `inspectTimeZoneSupport({ timeZoneId })` **without** an `instant` runs a package-owned probe
at each rule's `firstDivergenceInstant`, so the resulting `status`, `ruleId`, `ruleVersion`,
`expectedOffset`, `observedOffset`, and `firstDivergence` fields are safe to aggregate across many
hosts as an unbiased signal of real-world patch adoption — they don't depend on caller-supplied,
potentially skewed instants.

## Compatibility

This package works with native `Temporal` (when the host provides one) and with the bundled
[`temporal-polyfill`](https://www.npmjs.com/package/temporal-polyfill) dependency, without ever
assigning to `globalThis.Temporal`. See `test/temporal-compat.test.ts` for compatibility tests
covering both paths.

## Development

```bash
npm install
npm run build         # emit dist/ (ESM + .d.ts)
npm run typecheck      # tsc --noEmit
npm test               # vitest
npm run lint            # eslint
npm run format           # prettier --check
npm run release:validate # build + typecheck + test + lint + format + npm pack --dry-run
```

## Agent skills

Install the shared CLHbid workflow skills when working outside a devcontainer:

```bash
# Claude Code (the default)
./scripts/install-agent-skills.sh

# One named agent
./scripts/install-agent-skills.sh copilot

# Every agent detected by the installer
./scripts/install-agent-skills.sh '*'
```

The installer is safe to rerun to refresh the installed skill sources. A future devcontainer
should invoke this same non-interactive script rather than duplicate its commands.
