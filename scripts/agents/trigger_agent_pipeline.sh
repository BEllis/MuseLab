#!/usr/bin/env bash
set -euo pipefail

REF="${1:-main}"
MAX_ITERATIONS="${MAX_AGENT_PIPELINE_ITERATIONS:-50}"

AGENTS=(
  triage:agent-triage.yml
  investigate:agent-investigate.yml
  design:agent-design.yml
  implement:agent-implement.yml
)

latest_run_id() {
  local workflow="$1"
  gh run list \
    --workflow="$workflow" \
    --branch="$REF" \
    --limit 1 \
    --json databaseId \
    --jq '.[0].databaseId'
}

trigger_and_wait() {
  local workflow="$1"
  local issue_number="$2"
  local previous_run_id
  previous_run_id="$(latest_run_id "$workflow" || true)"

  echo "Triggering workflow: $workflow for issue #$issue_number (ref: $REF)"
  gh workflow run "$workflow" --ref "$REF" -f "issue_number=$issue_number"

  local run_id=""
  for _ in $(seq 1 30); do
    run_id="$(latest_run_id "$workflow")"
    if [ -n "$run_id" ] && [ "$run_id" != "$previous_run_id" ]; then
      break
    fi
    sleep 2
  done

  if [ -z "$run_id" ] || [ "$run_id" = "$previous_run_id" ]; then
    echo "Failed to detect a new workflow run for $workflow" >&2
    exit 1
  fi

  echo "Watching workflow run $run_id for $workflow"
  gh run watch "$run_id" --exit-status
}

for iteration in $(seq 1 "$MAX_ITERATIONS"); do
  echo "Agent pipeline scan $iteration/$MAX_ITERATIONS"
  progress=0

  for agent_workflow in "${AGENTS[@]}"; do
    agent="${agent_workflow%%:*}"
    workflow="${agent_workflow#*:}"
    issue_number="$(python3 scripts/agents/agent_work.py "$agent" | awk 'END {print}')"

    if [ "$issue_number" = "none" ]; then
      echo "No $agent work found."
      continue
    fi

    trigger_and_wait "$workflow" "$issue_number"
    progress=1
  done

  if [ "$progress" -eq 0 ]; then
    echo "No agent work remains."
    echo "Agent pipeline completed."
    exit 0
  fi
done

echo "Reached MAX_AGENT_PIPELINE_ITERATIONS=$MAX_ITERATIONS with work still present." >&2
exit 1
