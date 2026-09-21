# Agents

**Read `README.md` first** for the package's purpose, development setup, and usage.

This document is **agent-specific** guidance for working effectively in this codebase.

### Before Starting Work

1. Install dependencies with `npm install` once the package toolchain exists
1. Review the package interface, limitations, and source citations in `README.md`
1. Check for existing helpers, rule definitions, and test fixtures before adding new ones
1. Assign the issue to yourself — or to the person you are operating as — if that hasn't been
   done already, then set its `Status` to `In progress` on the CLHbid Delivery org project. See
   the `issue-tracker` skill for details.

### Before Finishing Work

1. Review your code for clarity, maintainability, and fitness for purpose
1. Ensure any new code is covered by tests
1. Run the repository's npm checks once the package toolchain exists: build, typecheck, tests,
   lint and format checks, and release validation. These scripts must remain suitable for CI and
   non-interactive agent runs.
1. Push the branch and open or update a pull request that references the issue it implements —
   see the `open-pr` skill
1. Request review from a human maintainer — see **How a run ends** below

### How a run ends

Passing repository checks is not finishing. Every run ends in exactly one of these three states —
see the `afk-loop` skill for why, and how each gets reviewed:

- **Complete** — set `Status` to `Ready for Human`. Open the pull request ready for review. Only
  claim this when checks pass, every acceptance criterion is addressed, and the agent brief is
  complete.
- **Blocked** — set `Status` to `Waiting on input`. Leave the pull request as a draft and comment
  with the specific question or action needed, and how to fix it.
- **Error** — set `Status` to `Ready for Human`. Leave the pull request as a draft and comment with
  what failed, and if possible what action can be taken to resolve the issue.

## Agent skills

The shared conventions are **installed, not committed**. They come from
[`clhbid/agent-context`](https://github.com/clhbid/agent-context) and
[`mattpocock/skills`](https://github.com/mattpocock/skills), and are installed for each agent so
this repository does not duplicate them:

- `issue-tracker` covers issues via `gh`, the `Status` field, board queries, triage roles, cycles,
  labels, the commit convention, and work decomposition.
- `afk-loop` covers dispatching work to cloud agents, reviewing what comes back, and handling a
  run that goes wrong.
- `open-pr` covers opening and updating a pull request.

Install them by hand with `./scripts/install-agent-skills.sh` — pass an agent name to install
elsewhere, for example `./scripts/install-agent-skills.sh copilot`, or `'*'` for every agent it
detects.

**If you are reading this without those skills, you have everything you need.** A cloud coding
agent may run in an environment that has not installed them: the commands above and **How a run
ends** are the whole contract. Anything else is reference material for a person or a session with
the skills to hand, never a prerequisite for finishing an issue. If you find you needed something
that isn't here, say so on the pull request so it can be added here rather than copied from the
shared skill documentation.
