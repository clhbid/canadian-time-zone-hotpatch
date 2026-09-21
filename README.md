# canadian-time-zone-hotpatch

A side-effect-free Temporal adapter for correcting stale Canadian timezone data.

This branch establishes the package toolchain and internal rule data. It intentionally has no
public API yet. The inspection and resolution interface is defined in issue `#1` and will be
exported by later delivery slices.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run release:validate
```

`release:validate` builds the ESM output and declarations, typechecks, tests, lints, checks
formatting, and verifies the dry-run npm package. Individual checks are also available through
`npm run build`, `npm run typecheck`, `npm test`, `npm run lint`, and `npm run format`.

## Interface and limitations

- The package root deliberately exports nothing in this foundation slice. Its rule, translation,
  Temporal, and host-observation modules are plumbing for the public inspection and resolution API.
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
