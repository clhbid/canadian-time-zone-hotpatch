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

Requires Node.js 22.13 or newer, or a browser, **and a compatible `Temporal` implementation**, which
this package does not ship. On a host with native `Temporal`, install nothing else and use the
top-level functions. Otherwise install a polyfill —
[`temporal-polyfill`](https://www.npmjs.com/package/temporal-polyfill), for instance — and either
install it globally with its `/global` entry point or pass it to `createHotpatch`, as
[Supplying a Temporal implementation](#supplying-a-temporal-implementation) shows.

`Temporal.ZonedDateTime.prototype.getTimeZoneTransition` is also required. Every native `Temporal`
has it; polyfills need at least `temporal-polyfill` 0.3.0 or `@js-temporal/polyfill` 0.5.0. An
implementation without it throws `MissingTemporalError`; see
[Supplying a Temporal implementation](#supplying-a-temporal-implementation) for when that happens.

## Usage

### Correcting instants

```ts
import {
  inspectTimeZoneSupport,
  TimeZoneSupportStatus,
  toCorrectedInstant,
  toCorrectedZonedTime,
  toTimeZoneLabel
} from "@clhbid/canadian-time-zone-hotpatch";

function show(instant: string, timeZoneId: string): string {
  // Correcting an unknown zone throws, so guard identifiers you haven't vetted.
  if (
    inspectTimeZoneSupport(timeZoneId).status === TimeZoneSupportStatus.unknown
  ) {
    return new Date(instant).toISOString();
  }

  // Format in the zone that comes back, not the one you passed.
  const display = toCorrectedZonedTime({ instant, timeZoneId });
  const label = toTimeZoneLabel({ instant, timeZoneId });

  const formatted = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: display.timeZoneId,
    // Without an approved label, fall back to the host's zone name.
    timeZoneName: label ? undefined : "short"
  }).format(new Date(display.instant));
  return label ? `${formatted} ${label.short}` : formatted;
}

show("2026-11-15T19:00:00Z", "America/Edmonton");
// "November 15, 2026 at 1:00 p.m. ABT"; an uncorrected host says 12:00 p.m.

const entry = toCorrectedInstant({
  wallTime: "2026-12-15T10:00:00",
  timeZoneId: "America/Edmonton",
  disambiguation: "compatible"
});
// entry.instant: "2026-12-15T16:00:00Z"; an uncorrected host gives 17:00:00Z.
```

### Supplying a Temporal implementation

```ts
import { createHotpatch } from "@clhbid/canadian-time-zone-hotpatch";
import { Temporal } from "temporal-polyfill";

// Once, at startup. These behave exactly like the top-level exports.
const { toCorrectedZonedTime, toTimeZoneLabel } = createHotpatch({
  temporal: Temporal
});
```

When the `Temporal` implementation is validated depends on whether you pass one to `createHotpatch`:

- `createHotpatch({ temporal })` validates the implementation it is given and throws immediately.
- The top-level functions, and an instance from `createHotpatch()` where you don't supply a
  `Temporal` implementation, read `globalThis.Temporal` when called and throw from that call.

Importing the package never throws, and each `Temporal` implementation is validated only once, not
on every call.

In CommonJS, on Node.js 22.13 or newer, `require()` loads the same entry point:

```js
const { createHotpatch } = require("@clhbid/canadian-time-zone-hotpatch");
const { Temporal } = require("temporal-polyfill");

const { toCorrectedZonedTime } = createHotpatch({ temporal: Temporal });
```

### Reporting host support to analytics

Each `status` is a `TimeZoneSupportStatus`, whose doc comments in [`src/types.ts`](./src/types.ts)
define every value. `rule_outdated` is the one to alert on: the host knows a change the rule table
doesn't, so the package needs updating.

```ts
import {
  inspectHostSupport,
  version
} from "@clhbid/canadian-time-zone-hotpatch";

declare function send(event: {
  rule_id: string;
  rule_status: string;
  package_version: string;
}): void;

// Once per session. The result describes this host's data, not the visitor's zone.
const host = inspectHostSupport();
for (const { ruleId, status } of host.ruleSupport) {
  send({ rule_id: ruleId, rule_status: status, package_version: version });
}
```

## Interface

Read [`src/index.ts`](./src/index.ts), [`src/`](./src/), and the specs in [`test/`](./test/) for the
shipped signatures and behavioural detail.

## Governed rules

| Jurisdiction          | Canonical zone        | Alias             | Permanent offset | Fixed zone  | Label                        |
| --------------------- | --------------------- | ----------------- | ---------------- | ----------- | ---------------------------- |
| Alberta               | `America/Edmonton`    | `Canada/Mountain` | `-06:00`         | `Etc/GMT+6` | Alberta Time (ABT)           |
| British Columbia      | `America/Vancouver`   | `Canada/Pacific`  | `-07:00`         | `Etc/GMT+7` | Pacific Time (PCT)           |
| Manitoba              | `America/Winnipeg`    | `Canada/Central`  | `-05:00`         | `Etc/GMT+5` | Manitoba Standard Time (MBT) |
| Northwest Territories | `America/Yellowknife` | —                 | `-06:00`         | `Etc/GMT+6` | —                            |
| Northwest Territories | `America/Inuvik`      | —                 | `-06:00`         | `Etc/GMT+6` | —                            |

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
// cases[0]: { timeZoneId: "America/Edmonton", instant: "2026-11-01T07:59:59.000Z" }
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
- Northwest Territories —
  [Northwest Territories Time Regulations, NWT Reg 090-2026](https://www.canlii.org/en/nt/laws/regu/nwt-reg-090-2026/latest/nwt-reg-090-2026.html),
  in force on 2026-08-21, which publish the long name "Northwest Territories Time" but no short
  code, so neither zone is labelled; the
  [announcement](https://www.gov.nt.ca/en/newsroom/northwest-territories-ends-seasonal-time-change)
  explains that the 2026-11-01 seasonal "fall back" is skipped. The two zones take a rule each
  because `America/Inuvik` needs its own upstream fix and so goes current later than
  `America/Yellowknife`

## Limitations

- This is not a timezone database. It corrects only the legislated changes above; every other zone
  passes through to the host unchanged, pinned against the host itself by
  [`test/pass-through.test.ts`](./test/pass-through.test.ts).
- Only the approved English labels are bundled, and only from a rule's first divergence onwards.
  Before it, `toTimeZoneLabel` returns nothing and a caller falls back to the host's own name for
  the zone (MST/MDT, PST/PDT, CST/CDT), as it does for a governed zone whose jurisdiction has not
  published an approved long/short label pair — the Northwest Territories zones today publish only
  the long name "Northwest Territories Time". The package derives no label from `Intl` itself.
  `toTimeZoneLabel` follows the rule table regardless of host status, including `rule_outdated`.
- It formats nothing. Applications format the corrected `instant` in the effective `timeZoneId`.
- `toCorrectedInstant` trusts the host's own disambiguation before the divergence day, so a host
  whose seasonal data is wrong for earlier years is not corrected.
- The polyfills above search only a few years past the later of the probed instant and the current
  time, so a polyfilled host reports a revision further out than that as `current` rather than
  `rule_outdated`, until the search window reaches it.
- A rule's verdict applies to every instant from its first divergence onwards, so a seasonal host
  is `stale` even in daylight periods, where its offset matches the rule's.

## Ownership and removal

CLHbid owns the rule table in this repository. A rule's `ruleId` is stable for the life of the rule;
a change to its offset, instants, or aliases ships as a new package version under semantic
versioning, not as per-rule version metadata. Telemetry keys on `ruleId` and the package version,
read from the `version` export rather than `package.json`.

This package is pre-1.0 and its interface is not yet settled: it may change in a minor version while
the rules and the correction behaviour are validated against production traffic. Pin an exact
version if that matters to you, and read the release notes before upgrading. Once the interface has
held up in production it ships as 1.0, and follows semantic versioning strictly from there.

The two halves of this package have different lifetimes. The **offset correction** is temporary and
retires as described below. The **approved label override** does not: host data will never supply
these names. ICU reports `CST` for a permanent UTC-6 zone — `America/Regina` does so today — and at
best adds a long name years later with no usable short form, as `America/Whitehorse` shows
(`Yukon Time`, abbreviated only as `GMT-7`). So `toTimeZoneLabel` outlives the corrections, and
correcting an instant deliberately says nothing about what the zone is called.

Once host timezone data for a jurisdiction is current across the user populations that telemetry
reports on, its correction is deprecated in this README for one minor release and then retired in
the next major release. The zone then reports `not_applicable` and correcting it passes through to
the host, while its label stays. Consumers should not rely on a correction outliving the stale hosts
it exists for.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run release:validate
```

`release:validate` builds the ESM output and declarations, typechecks, tests, lints, checks
formatting, and verifies the dry-run npm package; `package.json` lists the individual checks. The
TypeScript examples in this README are typechecked by `test/readme.test.ts`.

Publishing runs from the `Publish` workflow on a published GitHub release or a manual dispatch, with
npm provenance through trusted publishing. It never runs from a pull request, and it requires the
`npm-publish` environment and the package's trusted publisher to be configured on npm first.

Releases carry [provenance](https://docs.npmjs.com/generating-provenance-statements), so the
tarball on the registry is attested to the commit and the workflow that built it. To check what you
installed:

```bash
npm audit signatures
```

Contributor and agent workflow guidance lives in [`AGENTS.md`](./AGENTS.md).
