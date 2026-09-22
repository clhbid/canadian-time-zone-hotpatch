# canadian-time-zone-hotpatch

`@clhbid/canadian-time-zone-hotpatch` is a side-effect-free Temporal adapter that detects and
corrects stale Canadian permanent-time zone data on the host running it, without patching
`Temporal`, `Intl`, or any built-in globally.

Browser and operating-system timezone data lag behind Canadian provincial legislation that ends
seasonal clock changes. A stale host displays times an hour off and turns a wall-clock entry into
the wrong instant. This package owns a small, source-cited rule table for the affected zones,
corrects calculations in both directions only where the host is stale, and reports whether the
running host already knows those rules. Detection compares the offsets the host reports against
the offsets the rules require — never user agents, operating systems, ICU, Temporal
implementations, or tzdata versions.

## Install

```bash
npm install @clhbid/canadian-time-zone-hotpatch
```

Requires Node.js 22.13 or newer, or a browser, **and a compatible `Temporal` implementation**.
This package ships none: it reads `globalThis.Temporal` when the host has one, and otherwise the
one you pass to `createHotpatch`. Whether to polyfill `Temporal` is your application's decision —
it depends on the runtimes you support — so nothing is installed or bundled on your behalf, and
the package never assigns to `globalThis.Temporal` itself.

On a host with native `Temporal`, install nothing else and use the top-level functions. Without
one, install a polyfill — [`temporal-polyfill`](https://www.npmjs.com/package/temporal-polyfill),
for instance — and either install it globally with its `/global` entry point or hand it to
`createHotpatch`, as [Supplying a Temporal implementation](#supplying-a-temporal-implementation)
shows.

## Usage

The examples in this section are typechecked by `test/readme.test.ts`.

### Correcting instants

```ts
import {
  toCorrectedInstant,
  toCorrectedZonedTime
} from "@clhbid/canadian-time-zone-hotpatch";

// Display a stored instant. Pass the instant and the zone you are showing it
// in — often the viewer's own. Format with the zone that comes back, never
// the one you passed: on a stale host they differ, and that difference is the
// correction.
const display = toCorrectedZonedTime({
  instant: "2026-11-15T19:00:00Z",
  timeZoneId: "America/Edmonton"
});
// display.timeZoneId — "Etc/GMT+6" on a stale host, "America/Edmonton" on a current one
// display.offset     — "-06:00" either way
// display.label      — { long: "Alberta Time", short: "ABT" }

const formatted = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: display.timeZoneId
}).format(new Date(display.instant));
const shown = `${formatted} ${display.label?.short ?? ""}`;
// "November 15, 2026 at 1:00 p.m. ABT" — an uncorrected host says 12:00 p.m.

// Parse a wall-clock entry. A wall-clock reading carries no offset of its own.
// "reject" refuses a reading the zone repeats or skips rather than silently
// picking one of two moments.
const entry = toCorrectedInstant({
  wallTime: "2026-12-15T10:00:00",
  timeZoneId: "America/Edmonton",
  disambiguation: "reject"
});
const stored = entry.instant;
// "2026-12-15T16:00:00Z" — an uncorrected host produces 17:00:00Z.
```

### Supplying a Temporal implementation

```ts
import { createHotpatch } from "@clhbid/canadian-time-zone-hotpatch";
import { Temporal } from "temporal-polyfill";

// Once, where the application wires up its dependencies. The returned
// functions behave exactly like the top-level ones, on the implementation
// given here rather than on a global. Nothing is assigned to globalThis.
const { inspectHostSupport, toCorrectedInstant, toCorrectedZonedTime } =
  createHotpatch({ temporal: Temporal });

const display = toCorrectedZonedTime({
  instant: "2026-11-15T19:00:00Z",
  timeZoneId: "America/Edmonton"
});
// display.offset — "-06:00"
```

`createHotpatch()` with no implementation — which is what the top-level exports use — reads
`globalThis.Temporal` on every call, so a global polyfill installed during application bootstrap
is picked up even though the package was imported before it. When no compatible implementation can
be found, the call throws `MissingTemporalError`, naming both remedies; importing the package
never throws and never reads a global.

### Reporting host support to analytics

```ts
import { inspectHostSupport } from "@clhbid/canadian-time-zone-hotpatch";

// Once per session. No arguments: the package probes every rule it owns, at
// each rule's own first divergence, so the answer describes this host's
// timezone data rather than where the visitor happens to be.
const host = inspectHostSupport();
const event = {
  status: host.status, // "current" | "stale"
  staleRules: host.staleRuleIds.join(",") // "" when nothing is stale
};
// On a host that has the B.C. and Manitoba rules but not Alberta's:
// { status: "stale", staleRules: "ab-permanent-time-2026" }
//
// Send `event` once per session. It carries no zone, offset, instant or user
// agent, and never reads the visitor's own timezone.
```

## Interface

The signatures and types live in [`src/index.ts`](./src/index.ts) and ship as declarations in
`dist/`; the notes here cover behaviour the signatures do not say.

`toCorrectedZonedTime` corrects an instant for display and never changes the instant it is given.
`toCorrectedInstant` computes the instant a wall-clock reading denotes — the only direction that
produces new data, which is why `disambiguation` belongs there and nowhere else. Both return one
`CorrectedZonedTime`: the `instant`, the effective `timeZoneId` — the canonical named zone when
the host is current or the zone is ungoverned, the rule's fixed `Etc/GMT` zone when the host is
stale — the `offset` in that zone, the approved `label` with `long` and `short` forms (absent for
ungoverned zones), and the `support` result that chose the zone.

`CorrectedZonedTime.support` is per-zone support with a `status` of:

- `current` — the host agrees with the rule at the probed instant, or the rule has not yet
  diverged from seasonal time there, so no correction is required.
- `stale` — the host reports a legacy seasonal offset where the rule mandates a permanent one.
- `not_applicable` — a valid time zone that no rule in this package governs, including the
  unaffected B.C. regional zones `America/Dawson_Creek` and `America/Fort_Nelson`.
- `unknown` — the identifier is not a time zone the host recognizes.

Governed results (`current` and `stale`) carry the canonical `timeZoneId` and the `ruleId` that
classified them; the other statuses carry the `timeZoneId` as given.

For `toCorrectedZonedTime`, `support` is support at the instant. For `toCorrectedInstant` it is
the rule-owned probe from the divergence day on, because a stale host repeats that day's skipped
hour and mis-offsets every wall time after it, so the whole day must resolve in the fixed zone;
before that day, seasonal host data is correct and the host's own disambiguation applies.

`inspectHostSupport()` asks whether this host's timezone data knows the rules this package
patches. It takes no arguments and probes every rule at that rule's own first divergence, so the
result depends on neither the caller's zone nor any instant being displayed. `HostSupport.status`
is `stale` when any governed rule is stale, and `staleRuleIds` lists the stale rules individually
— rules can reach a host in different tzdata releases — in rule-table order, so joining it into an
analytics dimension yields a stable string. A host that cannot observe a governed zone at all
counts as stale for that rule, having demonstrably not got the rule.

`createHotpatch(options?)` binds the three functions above to one `Temporal` implementation:
`options.temporal` when you supply one, validated on the spot so a wrong value fails where the
mistake was made, or `globalThis.Temporal` read per call when you do not. The error classes are
not per instance — they are top-level exports, matched with `instanceof`.

Correction fails explicitly rather than guessing: `MissingTemporalError` when no compatible
`Temporal` is available, `UnknownTimeZoneError` for an unrecognized zone,
`OffsetBearingWallTimeError` for a wall-clock time carrying a UTC offset or `Z`, and Temporal's
`RangeError` for malformed instants or wall times and for `disambiguation: "reject"` at a repeated
or skipped time.

Every result the package returns is frozen.

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
- Only the approved English labels are bundled.
- It formats nothing. Applications format the corrected `instant` in the effective `timeZoneId`.
- `toCorrectedInstant` trusts the host's own disambiguation before the divergence day, so a
  host whose seasonal data is wrong for earlier years is not corrected.

## Ownership and removal

CLHbid owns the rule table in this repository. A rule's `ruleId` is stable for the life of the
rule; a change to its offset, instants, or aliases ships as a new package version under semantic
versioning, not as per-rule version metadata. Telemetry keys on `ruleId` and the package version.

Each rule is temporary. Once host timezone data for a jurisdiction is current across the user
populations that telemetry reports on, its rule is deprecated in this README for one minor
release and then removed in the next major release, at which point the zone reports
`not_applicable`. Consumers should not rely on a rule outliving the stale hosts it exists for.

## Compatibility

The package requires a compatible `Temporal` and treats native and polyfilled implementations
alike: it reads `globalThis.Temporal`, or uses the implementation given to `createHotpatch`, and
never assigns to `globalThis`. It depends only on `temporal-spec`, which is types-only and emits
no runtime code, so nothing beyond this package's own modules reaches your bundle. Every host read
goes through
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
