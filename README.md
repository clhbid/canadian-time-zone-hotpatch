# canadian-time-zone-hotpatch

A side-effect-free Temporal adapter for correcting stale Canadian timezone data.

This branch establishes the package toolchain and internal rule data. It intentionally has no
public API yet. The inspection and resolution interface is defined in issue `#1` and will be
exported by later delivery slices.

## Rule sources

The bundled rules currently cover:

- Alberta — `America/Edmonton` / `Canada/Mountain`
- British Columbia — `America/Vancouver` / `Canada/Pacific`
- Manitoba — `America/Winnipeg` / `Canada/Central`

Each internal rule records its source citations, including the enacted Manitoba legal source used
for its commencement date.

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
