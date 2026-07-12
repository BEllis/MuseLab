#!/usr/bin/env bash
# Trigger MuseLab agent pipelines in Harness CI (converted from trigger_agent_pipeline.sh).
set -euo pipefail

REF="${1:-main}"
MAX_ITERATIONS="${MAX_AGENT_PIPELINE_ITERATIONS:-50}"

: "${HARNESS_API_KEY:?Set HARNESS_API_KEY}"
: "${HARNESS_ACCOUNT_ID:?Set HARNESS_ACCOUNT_ID}"
: "${HARNESS_ORG_IDENTIFIER:?Set HARNESS_ORG_IDENTIFIER}"
: "${HARNESS_PROJECT_IDENTIFIER:?Set HARNESS_PROJECT_IDENTIFIER}"
: "${HARNESS_BASE_URL:=https://app.harness.io}"

AGENTS=(
  triage:Agent_Triage
  epic:Agent_Epic
  dependency:Agent_Dependency
  investigate:Agent_Investigate
  design:Agent_Design
  implement:Agent_Implement
)

latest_execution_id() {
  local pipeline_id="$1"
  curl -sf \
    -H "x-api-key: ${HARNESS_API_KEY}" \
    "${HARNESS_BASE_URL}/pipeline/api/pipeline/execution/summary?accountIdentifier=${HARNESS_ACCOUNT_ID}&orgIdentifier=${HARNESS_ORG_IDENTIFIER}&projectIdentifier=${HARNESS_PROJECT_IDENTIFIER}&pipelineIdentifier=${pipeline_id}&size=1" \
    | python3 -c 'import json,sys; data=json.load(sys.stdin); items=data.get("data",{}).get("content",[]); print(items[0]["planExecutionId"] if items else "")'
}

trigger_and_wait() {
  local pipeline_id="$1"
  local issue_number="$2"
  local previous_execution_id
  previous_execution_id="$(latest_execution_id "$pipeline_id" || true)"

  echo "Triggering Harness pipeline: ${pipeline_id} for issue #${issue_number} (ref: ${REF})"

  local runtime_input_yaml
  runtime_input_yaml="$(cat <<EOF
pipeline:
  name: ${pipeline_id}
  identifier: ${pipeline_id}
  projectIdentifier: ${HARNESS_PROJECT_IDENTIFIER}
  orgIdentifier: ${HARNESS_ORG_IDENTIFIER}
  variables:
    - name: issue_number
      type: String
      value: "${issue_number}"
  properties:
    ci:
      codebase:
        build:
          type: branch
          spec:
            branch: ${REF}
EOF
)"

  curl -sf -X POST \
    -H "x-api-key: ${HARNESS_API_KEY}" \
    -H "Content-Type: application/yaml" \
    "${HARNESS_BASE_URL}/pipeline/api/pipeline/execute/${pipeline_id}?accountIdentifier=${HARNESS_ACCOUNT_ID}&orgIdentifier=${HARNESS_ORG_IDENTIFIER}&projectIdentifier=${HARNESS_PROJECT_IDENTIFIER}" \
    --data-binary "${runtime_input_yaml}" >/dev/null

  local execution_id=""
  for _ in $(seq 1 30); do
    execution_id="$(latest_execution_id "$pipeline_id")"
    if [ -n "$execution_id" ] && [ "$execution_id" != "$previous_execution_id" ]; then
      break
    fi
    sleep 2
  done

  if [ -z "$execution_id" ] || [ "$execution_id" = "$previous_execution_id" ]; then
    echo "Failed to detect a new Harness execution for ${pipeline_id}" >&2
    exit 1
  fi

  echo "Watching Harness execution ${execution_id} for ${pipeline_id}"
  while true; do
    local status
    status="$(curl -sf \
      -H "x-api-key: ${HARNESS_API_KEY}" \
      "${HARNESS_BASE_URL}/pipeline/api/pipeline/execution/${execution_id}?accountIdentifier=${HARNESS_ACCOUNT_ID}&orgIdentifier=${HARNESS_ORG_IDENTIFIER}&projectIdentifier=${HARNESS_PROJECT_IDENTIFIER}" \
      | python3 -c 'import json,sys; print(json.load(sys.stdin).get("data",{}).get("pipelineExecutionSummary",{}).get("status",""))')"

    case "$status" in
      Success)
        echo "Harness execution ${execution_id} succeeded."
        return 0
        ;;
      Failed|Aborted|Errored|Expired|Rejected)
        echo "Harness execution ${execution_id} ended with status: ${status}" >&2
        exit 1
        ;;
      *)
        sleep 5
        ;;
    esac
  done
}

for iteration in $(seq 1 "$MAX_ITERATIONS"); do
  echo "Agent pipeline scan ${iteration}/${MAX_ITERATIONS}"
  progress=0

  for agent_pipeline in "${AGENTS[@]}"; do
    agent="${agent_pipeline%%:*}"
    pipeline_id="${agent_pipeline#*:}"
    issue_number="$(python3 scripts/agents/agent_work.py "$agent" | awk 'END {print}')"

    if [ "$issue_number" = "none" ]; then
      echo "No ${agent} work found."
      continue
    fi

    trigger_and_wait "$pipeline_id" "$issue_number"
    progress=1
  done

  if [ "$progress" -eq 0 ]; then
    echo "No agent work remains."
    echo "Agent pipeline completed."
    exit 0
  fi
done

echo "Reached MAX_AGENT_PIPELINE_ITERATIONS=${MAX_ITERATIONS} with work still present." >&2
exit 1
