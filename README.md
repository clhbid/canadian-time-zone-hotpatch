# canadian-time-zone-hotpatch

`@clhbid/canadian-time-zone-hotpatch` is a side-effect-free Temporal adapter that detects and
corrects stale Canadian permanent-time zone data on the host running it, without patching
`Temporal`, `Intl`, or any built-in globally.

Browser and operating-system timezone data lag behind Canadian provincial legislation that ends
seasonal clock changes. A stale host shows sale times an hour off and turns an admin's wall-clock
input into the wrong instant. This package owns a small, source-cited rule table for the affected
zones, tells the application whether the running host already knows those rules, and corrects
calculations in both directions only where the host is stale. Detection compares the offsets the
host reports against the offsets the rules require — never user agents, operating systems, ICU,
Temporal implementations, or tzdata versions.

## Install

```bash
npm install @clhbid/canadian-time-zone-hotpatch
```

Requires Node.js 22.13 or newer, or a browser. `temporal-polyfill` is a dependency and is used
whenever the host does not expose a `Temporal` global; the package never assigns to
`globalThis.Temporal` itself.

## Usage

```ts
import {
  inspectTimeZoneSupport,
  resolveLocalDateTime,
  resolveTimeZone
} from "@clhbid/canadian-time-zone-hotpatch";

// Does this host know the Alberta rule? Omitting `instant` probes at the
// rule's own first divergence, so the answer carries no caller bias.
inspectTimeZoneSupport({ timeZoneId: "America/Edmonton" });
// => { status: "stale", timeZoneId: "America/Edmonton",
//      ruleId: "ab-permanent-time-2026", expectedOffset: "-06:00",
//      observedOffset: "-07:00", firstDivergence: "2026-11-01T02:00:00-06:00" }

// Display an instant: a stale host is corrected through the fixed zone.
resolveTimeZone({
  instant: "2026-11-15T12:00:00Z",
  timeZoneId: "America/Edmonton"
});
// => { instant: "2026-11-15T12:00:00Z", timeZoneId: "Etc/GMT+6", offset: "-06:00",
//      label: "Alberta Time (ABT)", support: { status: "stale", ... } }

// Resolve a wall-clock time to the legislated instant.
resolveLocalDateTime({
  localDateTime: "2026-11-01T01:30:00",
  timeZoneId: "America/Edmonton",
  disambiguation: "compatible"
});
// => { instant: "2026-11-01T07:30:00Z", timeZoneId: "Etc/GMT+6", offset: "-06:00", ... }
```

Use `result.timeZoneId` and `result.offset` to format the corrected time with Temporal or `Intl`,
and `result.label` as the approved zone name in place of the host's.

## Interface

```ts
inspectTimeZoneSupport(input: {
  timeZoneId: string; // canonical id or alias, matched case-insensitively
  instant?: string; // ISO 8601; omit for the rule-owned probe
}): TimeZoneSupport;

resolveTimeZone(input: {
  instant: string; // ISO 8601 instant
  timeZoneId: string;
  locale?: Intl.LocalesArgument;
}): ResolvedTimeZone;

resolveLocalDateTime(input: {
  localDateTime: string; // ISO 8601 wall-clock time; a UTC offset or "Z" is rejected
  timeZoneId: string;
  disambiguation: "compatible" | "earlier" | "later" | "reject";
  locale?: Intl.LocalesArgument;
}): ResolvedLocalDateTime;

createTimeZoneHotpatch(
  config?: Partial<Pick<HotpatchConfig, "translations" | "fallbackLocale">>
): TimeZoneHotpatch;

defaultConfig: HotpatchConfig;

interface ResolvedTimeZone {
  instant: string; // ISO 8601 UTC
  timeZoneId: string; // the zone that produced `offset`
  offset: string; // e.g. "-06:00"
  label?: string; // approved label; absent for ungoverned zones
  support: TimeZoneSupport;
}
type ResolvedLocalDateTime = ResolvedTimeZone;

interface TimeZoneHotpatch {
  config: HotpatchConfig; // { rules, translations, fallbackLocale }, frozen
  inspectTimeZoneSupport, resolveTimeZone, resolveLocalDateTime; // as above
}
```

The public types `RuleId`, `TimeZoneRule`, `TimeZoneSupport`, `TimeZoneSupportStatus`,
`Disambiguation`, `TranslationDictionary`, and each function's input type are exported alongside.

`TimeZoneSupport.status` is one of:

- `current` — the host agrees with the rule at the probed instant, or the rule has not yet
  diverged from seasonal time there, so no correction is required.
- `stale` — the host reports a legacy seasonal offset where the rule mandates a permanent one.
- `not_applicable` — a valid time zone that no rule in this package governs, including the
  unaffected B.C. regional zones `America/Dawson_Creek` and `America/Fort_Nelson`.
- `unknown` — the identifier is not a time zone the host recognizes.

Governed results (`current` and `stale`) carry the canonical `timeZoneId`, `ruleId`,
`expectedOffset`, `observedOffset`, and `firstDivergence`.

Both resolvers return the resolved `instant`, the effective `timeZoneId` — the canonical named
zone when the host is current or the zone is ungoverned, the rule's fixed `Etc/GMT` zone when the
host is stale — the `offset` in that zone, the approved `label` (absent for ungoverned zones), and
the `support` result that chose the zone. For `resolveTimeZone` that is support at the instant.
For `resolveLocalDateTime` it is the rule-owned probe from the divergence day on, because a stale
host repeats that day's skipped hour and mis-offsets every wall time after it, so the whole day
must resolve in the fixed zone; before that day, seasonal host data is correct and the host's own
disambiguation applies.

Inspection never throws for a bad identifier. Resolution fails explicitly rather than guessing:
`UnknownTimeZoneError` for an unrecognized zone, `OffsetBearingLocalDateTimeError` for a wall-clock
time carrying a UTC offset or `Z`, and Temporal's `RangeError` for malformed instants or wall
times and for `disambiguation: "reject"` at a repeated or skipped time.

## Governed rules

| Jurisdiction     | Canonical zone      | Alias             | Permanent offset | Fixed zone  | Label               |
| ---------------- | ------------------- | ----------------- | ---------------- | ----------- | ------------------- |
| Alberta          | `America/Edmonton`  | `Canada/Mountain` | `-06:00`         | `Etc/GMT+6` | Alberta Time (ABT)  |
| British Columbia | `America/Vancouver` | `Canada/Pacific`  | `-07:00`         | `Etc/GMT+7` | Pacific Time (PCT)  |
| Manitoba         | `America/Winnipeg`  | `Canada/Central`  | `-05:00`         | `Etc/GMT+5` | Manitoba Time (MBT) |

Each rule keeps the instant its offset legally commences separate from its `firstDivergenceInstant`,
the skipped "fall back" on 2026-11-01 when a legacy host first disagrees with it; see
[`src/rules.ts`](./src/rules.ts). Fixed correction zones use IANA's inverted `Etc/GMT` signs: UTC-6
is `Etc/GMT+6`.

Sources, also cited beside each rule in [`src/rules.ts`](./src/rules.ts):

- Alberta — [Order in Council 204/2026](https://kings-printer.alberta.ca/Documents/Orders/Orders_in_Council/2026/2026_204.html)
  proclaiming the [Official Time Act](https://www.canlii.org/en/ab/laws/stat/rsa-2000-c-o-5.7/latest/rsa-2000-c-o-5.7.html)
  in force on 2026-06-18
- British Columbia — [Order in Council 63/2026](https://www.bclaws.gov.bc.ca/civix/document/id/oic/oic_cur/0063_2026)
  bringing the Interpretation Amendment Act into force on 2026-03-09
- Manitoba — [The Official Time Amendment Act](https://web2.gov.mb.ca/laws/statutes/2023/c00423.php?lang=en)
  and the [permanent-time announcement](https://news.gov.mb.ca/news/?item=75397); the change is
  announced but not yet proclaimed, so its legal commencement remains unset

## Limitations

- This is not a timezone database. It corrects only the legislated changes above; every other
  zone passes through to the host.
- Only `en-CA` labels are bundled. Supply other locales through `createTimeZoneHotpatch`.
- It formats nothing. Applications format the corrected `instant` in the effective `timeZoneId`.
- `resolveLocalDateTime` trusts the host's own disambiguation before the divergence day, so a
  host whose seasonal data is wrong for earlier years is not corrected.

## Ownership and removal

CLHbid owns the rule table in this repository. A rule's `ruleId` is stable for the life of the
rule; a change to its offset, instants, or aliases ships as a new package version under semantic
versioning, not as per-rule version metadata. Telemetry keys on `ruleId` and the package version.

Each rule is temporary. Once host timezone data for a jurisdiction is current across the user
populations that telemetry reports on, its rule is deprecated in this README for one minor
release and then removed in the next major release, at which point the zone reports
`not_applicable`. Consumers should not rely on a rule outliving the stale hosts it exists for.

## Translation configuration

`defaultConfig.translations` ships approved `en-CA` labels keyed by locale and `ruleId`.
`createTimeZoneHotpatch({ translations, fallbackLocale })` merges supplied labels over the defaults
per locale and rule, and `fallbackLocale` names the locale used when a requested one has no label.
Requested locales are tried in order and canonicalized; a rule with no label anywhere resolves to
its `ruleId`. Configuration changes labels only — rules, offsets, and inspection behaviour are
fixed. Instances and `defaultConfig` are frozen.

```ts
const hotpatch = createTimeZoneHotpatch({
  translations: {
    "fr-CA": { "ab-permanent-time-2026": "Heure de l'Alberta (ABT)" }
  }
});
hotpatch.resolveTimeZone({
  instant: "2026-11-15T12:00:00Z",
  timeZoneId: "America/Edmonton",
  locale: "fr-CA"
}).label; // => "Heure de l'Alberta (ABT)"
```

## Telemetry-safe fields

`inspectTimeZoneSupport({ timeZoneId })` without an `instant` probes at the rule's own
`firstDivergenceInstant`, so `status`, `ruleId`, `expectedOffset`, `observedOffset`, and
`firstDivergence` depend only on the host's timezone data. They carry no user input and no
identifying information, and are safe to aggregate across hosts as a measure of how many users
still run stale data. Use one event per governed zone; `not_applicable` and `unknown` carry only
`status` and the `timeZoneId` as given.

## Compatibility

The package reads a native `Temporal` global when the host provides one and otherwise uses the
bundled `temporal-polyfill`; it never assigns to `globalThis`. Every host read goes through
[`src/host.ts`](./src/host.ts), so the tests simulate a legacy or updated host instead of depending
on the runner's own tzdata.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run release:validate
```

`release:validate` builds the ESM output and declarations, typechecks, tests, lints, checks
formatting, and verifies the dry-run npm package. Individual checks are also available through
`npm run build`, `npm run typecheck`, `npm test`, `npm run lint`, and `npm run format`.

Publishing runs from the `Publish` workflow on a published GitHub release or a manual dispatch,
with npm provenance through trusted publishing. It never runs from a pull request, and it requires
the `npm-publish` environment and the package's trusted publisher to be configured on npm first.

Contributor and agent workflow guidance lives in [`AGENTS.md`](./AGENTS.md).
