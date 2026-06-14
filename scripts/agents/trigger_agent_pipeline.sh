#!/usr/bin/env bash
set -euo pipefail

REF="${1:-main}"

WORKFLOWS=(
  agent-triage.yml
  agent-investigate.yml
  agent-design.yml
  agent-implement.yml
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
  local previous_run_id
  previous_run_id="$(latest_run_id "$workflow" || true)"

  echo "Triggering workflow: $workflow (ref: $REF)"
  gh workflow run "$workflow" --ref "$REF"

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

for workflow in "${WORKFLOWS[@]}"; do
  trigger_and_wait "$workflow"
done

echo "Agent pipeline completed."
