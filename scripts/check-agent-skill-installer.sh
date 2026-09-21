#!/usr/bin/env bash
set -euo pipefail

SCRIPT="$(dirname "$0")/install-agent-skills.sh"

bash -n "$SCRIPT"

for expected in \
  'AGENT="${1:-claude-code}"' \
  'clhbid/agent-context' \
  'mattpocock/skills' \
  'npx -y skills add "$package" --global --yes --agent "$AGENT"'; do
  if ! grep -F -- "$expected" "$SCRIPT" > /dev/null; then
    echo "Missing required installer content: $expected" >&2
    exit 1
  fi
done
