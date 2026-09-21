# canadian-time-zone-hotpatch

A side-effect-free Temporal adapter for correcting stale Canadian timezone data.

## Install

```bash
npm install @clhbid/canadian-time-zone-hotpatch
```

## Public API

The package currently exports:

- `rules` — immutable, source-cited rule data for governed zones
- `normalizeTimeZoneId(timeZoneId)` — resolves known aliases to canonical IANA ids
- `observeOffset(timeZoneId, instant)` — reads the host-reported offset for an instant
- `isKnownTimeZoneId(timeZoneId)` — checks whether the host recognizes a zone id
- `defaultTranslations`, `defaultFallbackLocale`, and `mergeTranslations(...)`

## Usage

```ts
import {
  isKnownTimeZoneId,
  normalizeTimeZoneId,
  observeOffset,
  rules,
} from "@clhbid/canadian-time-zone-hotpatch";
import { Temporal } from "temporal-polyfill";

const timeZoneId = normalizeTimeZoneId("Canada/Mountain");
const instant = Temporal.Instant.from("2026-11-01T09:00:00Z");

if (isKnownTimeZoneId(timeZoneId)) {
  const hostOffset = observeOffset(timeZoneId, instant);
  const rule = rules.find((entry) => entry.canonicalTimeZoneId === timeZoneId);
}
```

## Limitations

- Version `0.1.0` ships rule data and host-observation helpers only.
- Runtime inspection and automatic correction APIs are tracked separately under issue `#1`.
- The packaged translations include `en-CA` labels only; callers may layer additional labels with `mergeTranslations`.

## Rule sources

The bundled rules currently cover:

- Alberta — `America/Edmonton` / `Canada/Mountain`
- British Columbia — `America/Vancouver` / `Canada/Pacific`
- Manitoba — `America/Winnipeg` / `Canada/Central`

Each exported rule includes its own source citations in `rule.citations`, including the enacted Manitoba legal source used for its commencement date.

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
