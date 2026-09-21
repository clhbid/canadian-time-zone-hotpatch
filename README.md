# canadian-time-zone-hotpatch

A side-effect-free Temporal adapter for correcting stale Canadian timezone data.

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
