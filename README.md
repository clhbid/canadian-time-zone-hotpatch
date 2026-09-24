# canadian-time-zone-hotpatch

`@clhbid/canadian-time-zone-hotpatch` is a side-effect-free Temporal adapter that detects and
corrects stale Canadian permanent-time zone data on the host running it, without patching
`Temporal`, `Intl`, or any built-in globally.

Browser and operating-system timezone data lag behind Canadian provincial legislation that ends
seasonal clock changes. A stale host displays times an hour off and turns a wall-clock entry into
the wrong instant. This package owns a small, source-cited rule table for the affected zones,
corrects calculations in both directions only where the host is stale, and reports whether the
running host already knows those rules. Detection compares the offsets the host reports against the
offsets the rules require — never user agents, operating systems, ICU, Temporal implementations, or
tzdata versions.

## Install

```bash
npm install @clhbid/canadian-time-zone-hotpatch
```

This package is pre-1.0 and its interface is not yet settled: it may change in a minor version while
the rules and the correction behaviour are validated against production traffic. Pin an exact
version if that matters to you, and read the release notes before upgrading. Once the interface has
held up in production it ships as 1.0, and follows semantic versioning strictly from there.

Requires Node.js 22.13 or newer, or a browser, **and a compatible `Temporal` implementation**. This
package ships none: it reads `globalThis.Temporal` when the host has one, and otherwise the one you
pass to `createHotpatch`. Whether to polyfill `Temporal` is your application's decision — it depends
on the runtimes you support — so nothing is installed or bundled on your behalf, and the package
never assigns to `globalThis.Temporal` itself.

On a host with native `Temporal`, install nothing else and use the top-level functions. Without one,
install a polyfill — [`temporal-polyfill`](https://www.npmjs.com/package/temporal-polyfill), for
instance — and either install it globally with its `/global` entry point or hand it to
`createHotpatch`, as [Supplying a Temporal implementation](#supplying-a-temporal-implementation)
shows.

### Verifying this package

Releases are published from CI with
[provenance](https://docs.npmjs.com/generating-provenance-statements), so the tarball on the
registry is attested to the commit and the workflow that built it. To check what you installed:

```bash
npm audit signatures
```

## Usage

The examples in this section are typechecked by `test/readme.test.ts`.

### Correcting instants

```ts
import {
  inspectTimeZoneSupport,
  TimeZoneSupportStatus,
  toCorrectedInstant,
  toCorrectedZonedTime,
  toTimeZoneLabel
} from "@clhbid/canadian-time-zone-hotpatch";

// Guard an unvetted identifier: correcting an unknown zone throws.
function show(instant: string, timeZoneId: string): string {
  if (
    inspectTimeZoneSupport(timeZoneId).status === TimeZoneSupportStatus.unknown
  ) {
    // No correction is possible, so fall back rather than throw.
    return new Date(instant).toISOString();
  }

  // Format with the zone that comes back, never the one you passed.
  const display = toCorrectedZonedTime({ instant, timeZoneId });
  // display.timeZoneId — "Etc/GMT+6" on a stale host, "America/Edmonton" on a current one
  // display.offset     — "-06:00" either way

  // Undefined before the zone's first divergence, and for an ungoverned zone.
  const label = toTimeZoneLabel({ instant, timeZoneId });
  // label — { long: "Alberta Time", short: "ABT" }

  const formatted = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: display.timeZoneId
  }).format(new Date(display.instant));
  return `${formatted} ${label?.short ?? ""}`;
}

const shown = show("2026-11-15T19:00:00Z", "America/Edmonton");
// "November 15, 2026 at 1:00 p.m. ABT" — an uncorrected host says 12:00 p.m.

// A wall time carries no offset; "reject" refuses repeated or skipped ones.
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
const {
  inspectHostSupport,
  inspectTimeZoneSupport,
  toCorrectedInstant,
  toCorrectedZonedTime,
  toTimeZoneLabel
} = createHotpatch({ temporal: Temporal });

const display = toCorrectedZonedTime({
  instant: "2026-11-15T19:00:00Z",
  timeZoneId: "America/Edmonton"
});
// display.offset — "-06:00"
```

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

### Using with Node.js

In an ES module:

```ts
import { createHotpatch } from "@clhbid/canadian-time-zone-hotpatch";
import { Temporal } from "temporal-polyfill";

const { toCorrectedZonedTime } = createHotpatch({ temporal: Temporal });

const display = toCorrectedZonedTime({
  instant: "2026-11-15T19:00:00Z",
  timeZoneId: "America/Edmonton"
});
// display.offset — "-06:00"
```

In CommonJS, on Node.js 22.13 or newer, `require()` loads the same entry point:

```js
const { createHotpatch } = require("@clhbid/canadian-time-zone-hotpatch");
const { Temporal } = require("temporal-polyfill");

const { toCorrectedZonedTime } = createHotpatch({ temporal: Temporal });
```

## Interface

Read [`src/index.ts`](./src/index.ts), [`src/`](./src/), and the specs in [`test/`](./test/) for the
shipped signatures and behavioural detail.

## Governed rules

| Jurisdiction     | Canonical zone      | Alias             | Permanent offset | Fixed zone  | Label                        |
| ---------------- | ------------------- | ----------------- | ---------------- | ----------- | ---------------------------- |
| Alberta          | `America/Edmonton`  | `Canada/Mountain` | `-06:00`         | `Etc/GMT+6` | Alberta Time (ABT)           |
| British Columbia | `America/Vancouver` | `Canada/Pacific`  | `-07:00`         | `Etc/GMT+7` | Pacific Time (PCT)           |
| Manitoba         | `America/Winnipeg`  | `Canada/Central`  | `-05:00`         | `Etc/GMT+5` | Manitoba Standard Time (MBT) |

Each rule keeps the instant its offset legally commences separate from its `firstDivergenceInstant`,
the skipped "fall back" on 2026-11-01 when a legacy host first disagrees with it; see
[`src/rules.ts`](./src/rules.ts). Fixed correction zones use IANA's inverted `Etc/GMT` signs: UTC-6
is `Etc/GMT+6`.

The same table is exported as `rules`, frozen, for applications to test against. Deriving cases
from it keeps an application's tests in step with the package instead of copying its dates:

```ts
import { rules } from "@clhbid/canadian-time-zone-hotpatch";

// A second before, and at, each rule's first divergence.
const cases = rules.flatMap((rule) => {
  const divergence = Date.parse(rule.firstDivergenceInstant);
  return [divergence - 1000, divergence].map((epochMs) => ({
    timeZoneId: rule.canonicalTimeZoneId,
    instant: new Date(epochMs).toISOString()
  }));
});
// cases[0] — { timeZoneId: "America/Edmonton", instant: "2026-11-01T07:59:59.000Z" }
```

Sources, also cited beside each rule in [`src/rules.ts`](./src/rules.ts):

- Alberta —
  [Order in Council 204/2026](https://kings-printer.alberta.ca/Documents/Orders/Orders_in_Council/2026/2026_204.html)
  proclaiming the
  [Official Time Act](https://www.canlii.org/en/ab/laws/stat/rsa-2000-c-o-5.7/latest/rsa-2000-c-o-5.7.html)
  in force on 2026-06-18; the label comes from the province's
  [Alberta Time announcement](https://www.alberta.ca/albertas-new-time-system-abt)
- British Columbia —
  [Order in Council 63/2026](https://www.bclaws.gov.bc.ca/civix/document/id/oic/oic_cur/0063_2026)
  bringing the Interpretation Amendment Act into force on 2026-03-09; the label comes from the
  province's [news release](https://news.gov.bc.ca/releases/2026CITZ0009-001073), which names PCT as
  replacing PST and PDT
- Manitoba —
  [The Official Time Amendment Act](https://web2.gov.mb.ca/laws/statutes/2023/c00423.php?lang=en),
  S.M. 2023, c. 4, whose s. 1 defines Manitoba Standard Time and whose s. 2(1.1) gives MBT, and the
  [permanent-time announcement](https://news.gov.mb.ca/news/?item=75397); that Act is not in force —
  s. 4 commences it on a day fixed by proclamation and none has been made — so its legal
  commencement remains unset

## Limitations

- This is not a timezone database. It corrects only the legislated changes above; every other zone
  passes through to the host. Concretely: **for a zone outside the rule table, this package returns
  exactly what the bare host returns** — the same offset and instant correcting either direction,
  `inspectTimeZoneSupport` reporting `not_applicable`, and `toTimeZoneLabel` returning nothing. That
  guarantee is what makes it safe to call this package on an arbitrary identifier, including one
  read straight from `Intl.DateTimeFormat().resolvedOptions().timeZone`, without checking it against
  the rule table first. It is pinned by a differential spec
  ([`test/pass-through.test.ts`](./test/pass-through.test.ts)) that compares this package's output
  against the host's for every zone the host recognizes outside the rule table, derived from the
  exported `rules` table so that a new rule removes its zones from the spec automatically.
- Only the approved English labels are bundled, and only from a rule's first divergence onwards.
  Before it, `toTimeZoneLabel` returns nothing and a caller falls back to the host's own name for
  the zone (MST/MDT, PST/PDT, CST/CDT). The package derives no label from `Intl` itself.
- It formats nothing. Applications format the corrected `instant` in the effective `timeZoneId`.
- `toCorrectedInstant` trusts the host's own disambiguation before the divergence day, so a host
  whose seasonal data is wrong for earlier years is not corrected.

## Ownership and removal

CLHbid owns the rule table in this repository. A rule's `ruleId` is stable for the life of the rule;
a change to its offset, instants, or aliases ships as a new package version under semantic
versioning, not as per-rule version metadata. Telemetry keys on `ruleId` and the package version.

The two halves of this package have different lifetimes. The **offset correction** is temporary and
retires as described below. The **approved label override** does not: host data will never supply
these names. ICU reports `CST` for a permanent UTC-6 zone — `America/Regina` does so today — and at
best adds a long name years later with no usable short form, as `America/Whitehorse` shows
(`Yukon Time`, abbreviated only as `GMT-7`). So `toTimeZoneLabel` outlives the corrections, and
correcting an instant deliberately says nothing about what the zone is called.

Each rule's correction is temporary. Once host timezone data for a jurisdiction is current across
the user populations that telemetry reports on, its correction is deprecated in this README for one
minor release and then retired in the next major release, at which point the zone reports
`not_applicable` and correcting it passes through to the host. Retiring a correction does not retire
the rule's label: `toTimeZoneLabel` goes on answering for that zone, because host data still will
not carry the approved name. Consumers should not rely on a correction outliving the stale hosts it
exists for.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run release:validate
```

`release:validate` builds the ESM output and declarations, typechecks, tests, lints, checks
formatting, and verifies the dry-run npm package. Individual checks are also available through
`npm run build`, `npm run typecheck`, `npm test`, `npm run lint`, and `npm run format`.

Publishing runs from the `Publish` workflow on a published GitHub release or a manual dispatch, with
npm provenance through trusted publishing. It never runs from a pull request, and it requires the
`npm-publish` environment and the package's trusted publisher to be configured on npm first.

Contributor and agent workflow guidance lives in [`AGENTS.md`](./AGENTS.md).
