import sys
import os
import re

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import github_utils

from dotenv import load_dotenv
load_dotenv()

import pydantic
from agent_config import model_for_agent
from agent_session import create_session_id, with_fresh_session_instructions
from openrouter_client import chat_structured

TRIAGE_COMMENT_TAG = "<!-- triage-recommendation -->"

DEFER_PATTERNS = (
    "defer unless",
    "defer until",
    "future / deferred",
    "tracks under #7",
    "only if audience",
    "only if explicitly requested",
)

RESEARCH_PATTERNS = (
    "evaluate demand",
    "evaluate whether",
    "evaluate options",
    "research",
    "investigate options",
    "user consultation",
    "stakeholder",
    "parity matrix",
    "prior art",
    "compare with",
    "vs deepening",
)

EPIC_INDICATOR_PATTERNS = (
    "unreal",
    "godot",
    "unity",
    "plugin",
    "plugins",
    "engine",
    "integration",
    "multiple",
    "separate epic",
)


class TriageClassification(pydantic.BaseModel):
    conforms: bool
    missing_sections: list[str]
    priority: str
    readiness: str
    risk: str
    value: str
    issue_shape: str  # single_task | epic | research_spike
    recommend_epic: bool
    needs_product_input: bool
    explanation: str


def build_triage_prompt(title: str, body: str, current_labels: set[str]) -> str:
    label_summary = ", ".join(sorted(current_labels)) if current_labels else "(none)"
    return f"""
Analyze the following GitHub issue and classify it for an automated agent pipeline.

Issue Title: {title}
Current Labels: {label_summary}
Issue Body:
{body}

## Conformance
- Bug reports must contain: '## Description', '## Steps to Reproduce', '## Expected Behavior',
  '## Actual Behavior', and '## Environment Info'.
- Features/tasks/refactors/chores must contain: '## Goal / Problem Description',
  '## Proposed Changes / Requirements', and '## Technical Notes / Context'.
- Epics should ideally use '## Goal', '## Background / Context', '## Tasks' (checkbox list),
  and '## Acceptance Criteria'. If an issue is clearly an epic but uses the feature template,
  set conforms=true and recommend_epic=true.

## Issue shape (issue_shape)
Choose exactly one:
- single_task: One scoped deliverable an engineer can implement directly.
- epic: Multiple independent deliverables, platforms, or workstreams that should be tracked
  separately (often weeks of work each). Example: "Unreal plugin" AND "Godot plugin" AND
  "demand evaluation" are not one task.
- research_spike: Primary outcome is investigation, evaluation, documentation of options,
  or user/market consultation — not shipping code yet.

## Epic detection (recommend_epic)
Set recommend_epic=true when ANY of these apply:
- Requirements list 2+ independent deliverables that could each be their own issue/epic.
- Work spans multiple engines, platforms, integrations, or major subsystems.
- The issue describes a roadmap initiative rather than one implementation change.
- Technical notes say to defer, evaluate first, or decide between alternatives before building.
- The issue tracks under a deferred/future initiative epic (e.g. #7) but is still written as a
  single feature ticket.

## Readiness (when to use each label)
- agent:ready: ONLY for single_task issues with a clear, bounded implementation path and no
  open product/strategy decisions. An agent can pick this up and write a plan or code immediately.
- agent:investigate: Needs codebase research, spike, options analysis, or demand/technical
  evaluation before planning. Use for research_spike issues and for epics that have not been
  broken down yet.
- human:investigate: Needs maintainer/product owner input, user consultation, prioritization
  between alternatives, or a go/no-go decision on deferred work. Use when needs_product_input=true.
- human:ready: Non-code work that only a human should perform (legal, release management, etc.).

NEVER set agent:ready when:
- issue_shape is epic or research_spike
- The body says defer, evaluate demand, or compare strategic options first
- Requirements are conditional ("If built...", "Evaluate whether...")
- Multiple plugins/engines/features are bundled together
- No investigation or stakeholder input has happened yet for a strategic initiative

## Priority / risk / value
- Deferred or future-initiative work is usually priority:low and value:low unless actively requested.
- Epic-scale integrations are usually risk:high until scoped.
- needs_product_input=true when maintainers must decide direction before agents proceed.

Return JSON matching the schema. Be conservative: when unsure between agent:ready and
agent:investigate, choose agent:investigate.
"""


def apply_classification_overrides(
    title: str,
    body: str,
    classification: TriageClassification,
) -> TriageClassification:
    text = f"{title}\n{body}".lower()
    data = classification.model_dump()

    if any(pattern in text for pattern in DEFER_PATTERNS):
        data["issue_shape"] = "research_spike"
        data["recommend_epic"] = True
        data["needs_product_input"] = True
        data["priority"] = "low"
        if data["readiness"] == "agent:ready":
            data["readiness"] = "human:investigate"

    if any(pattern in text for pattern in RESEARCH_PATTERNS):
        if data["issue_shape"] == "single_task":
            data["issue_shape"] = "research_spike"
        if data["readiness"] == "agent:ready":
            data["readiness"] = (
                "human:investigate" if data.get("needs_product_input") else "agent:investigate"
            )

    if data.get("recommend_epic") and data["readiness"] == "agent:ready":
        data["readiness"] = (
            "human:investigate" if data.get("needs_product_input") else "agent:investigate"
        )

    if data.get("issue_shape") == "epic" and data["readiness"] == "agent:ready":
        data["readiness"] = "agent:investigate"

    if data.get("issue_shape") == "research_spike" and data["readiness"] == "agent:ready":
        data["readiness"] = (
            "human:investigate" if data.get("needs_product_input") else "agent:investigate"
        )

    bullet_lines = [
        line.strip()
        for line in body.splitlines()
        if re.match(r"^[-*]\s+", line.strip())
    ]
    if len(bullet_lines) >= 2 and any(
        keyword in text for keyword in EPIC_INDICATOR_PATTERNS
    ):
        data["recommend_epic"] = True
        if data["issue_shape"] == "single_task":
            data["issue_shape"] = "epic"

    return TriageClassification.model_validate(data)


def post_triage_recommendation(issue_num: int, classification: TriageClassification) -> None:
    if not classification.recommend_epic and classification.issue_shape != "research_spike":
        return

    comments_res = github_utils.get_issue_details(issue_num)
    if comments_res:
        for comment in comments_res.get("comments", []):
            if TRIAGE_COMMENT_TAG in (comment.get("body") or ""):
                return

    lines = [
        TRIAGE_COMMENT_TAG,
        "### Triage recommendation",
        classification.explanation,
        "",
    ]

    if classification.recommend_epic:
        lines.extend(
            [
                "This looks like an **epic**, not a single implementation task.",
                "Suggested next steps:",
                "1. Convert to an `[EPIC]` issue using the epic template.",
                "2. Add a `## Tasks` checklist — one item per engine/plugin/workstream.",
                "3. Create child issues (or nested epics) for each major deliverable.",
                "4. Keep research/evaluation tasks separate from build tasks.",
            ]
        )

    if classification.issue_shape == "research_spike" or classification.needs_product_input:
        lines.extend(
            [
                "",
                "This needs **research and/or product input** before implementation.",
                "It should not go straight to `agent:ready` / design / implement.",
                "Run investigation first, then decide with maintainers/users whether to proceed.",
            ]
        )

    github_utils.add_issue_comment(issue_num, "\n".join(lines))


def sync_epic_checklist(issue_num: int, body: str) -> str:
    checklist_pattern = re.compile(r'^(\s*[-*]\s*\[\s*[ xX]?\s*\]\s*)(.+)$', re.MULTILINE)
    body_lines = body.splitlines()
    updated_lines = []
    body_changed = False

    for line in body_lines:
        match = checklist_pattern.match(line)
        if match:
            prefix = match.group(1)
            task_text = match.group(2).strip()
            has_issue_ref = re.search(r'#\s*\d+', task_text) or "issues/" in task_text

            if not has_issue_ref:
                print(f"Found new sub-task checklist item: '{task_text}' in Epic #{issue_num}")
                sub_title = f"[SUB-TASK] {task_text}"
                sub_body = f"Part of Epic #{issue_num}."
                sub_issue_num = github_utils.create_github_issue(sub_title, sub_body)
                if sub_issue_num:
                    print(f"Created sub-issue #{sub_issue_num} for task '{task_text}'")
                    status_char = "x" if "x" in prefix.lower() else " "
                    list_bullet = "-" if "-" in prefix else "*"
                    leading_ws = prefix[: prefix.find(list_bullet)]
                    line = f"{leading_ws}{list_bullet} [{status_char}] #{sub_issue_num} {task_text}"
                    body_changed = True
                else:
                    print("Failed to create sub-issue.")
        updated_lines.append(line)

    if not body_changed:
        return body

    new_body = "\n".join(updated_lines)
    print(f"Updating body of Epic #{issue_num}...")
    github_utils.update_issue_body(issue_num, new_body)
    return new_body


def triage_issue(issue):
    issue_num = issue["number"]
    title = issue["title"]
    body = issue["body"] or ""
    current_labels = {label["name"] for label in issue.get("labels", [])}

    print(f"\n--- Triaging Issue #{issue_num}: {title} ---")

    is_epic = "epic" in current_labels or title.upper().startswith("[EPIC]")
    if is_epic:
        body = sync_epic_checklist(issue_num, body)

    session_id = create_session_id("triage", issue_num)
    print(f"Starting fresh triage session: {session_id}")
    triage_info = chat_structured(
        model=model_for_agent("triage"),
        system=with_fresh_session_instructions(
            "You are an expert triage agent for GitHub issues on the MuseLab project. "
            "Classify issues conservatively: prefer investigation over agent:ready when work "
            "is strategic, deferred, multi-deliverable, or lacks product decisions."
        ),
        user=build_triage_prompt(title, body, current_labels),
        response_model=TriageClassification,
        session_id=session_id,
    )
    triage_data = apply_classification_overrides(title, body, triage_info).model_dump()
    print(f"Classification result: {triage_data}")

    if not is_epic and not triage_data.get("conforms", True):
        missing = triage_data.get("missing_sections", [])
        comment_warning_tag = "<!-- conformance-warning -->"
        comments_res = github_utils.get_issue_details(issue_num)
        has_warning = False
        if comments_res:
            for comment in comments_res.get("comments", []):
                if comment_warning_tag in (comment.get("body") or ""):
                    has_warning = True
                    break

        if not has_warning:
            missing_list = ", ".join(f"`{item}`" for item in missing)
            warning_body = f"""{comment_warning_tag}
Hi! Thanks for creating this issue. It seems it does not conform to our issue template.
Please update the description to include the following missing sections: {missing_list}.
This helps our automated agents pick up and process this issue!
"""
            print(f"Posting conformance warning to #{issue_num}.")
            github_utils.add_issue_comment(issue_num, warning_body)

    post_triage_recommendation(issue_num, TriageClassification.model_validate(triage_data))

    state_relation = github_utils.get_issue_relations(issue_num)
    print(f"Codebase status relation for #{issue_num}: {state_relation}")

    target_labels = set(current_labels)
    if is_epic or triage_data.get("recommend_epic"):
        target_labels.add("epic")

    has_priority = any(label.startswith("priority:") for label in target_labels)
    has_risk = any(label.startswith("risk:") for label in target_labels)
    has_val = any(label.startswith("value:") for label in target_labels)

    for readiness_label in (
        "agent:ready",
        "human:ready",
        "agent:investigate",
        "human:investigate",
    ):
        target_labels.discard(readiness_label)
    target_labels.add(triage_data["readiness"])
    if triage_data["readiness"] in {"agent:investigate", "human:investigate"}:
        target_labels.discard("agent:planned")

    if not has_priority:
        target_labels.add(f"priority:{triage_data['priority']}")
    if not has_risk:
        target_labels.add(f"risk:{triage_data['risk']}")
    if not has_val:
        target_labels.add(f"value:{triage_data['value']}")

    if state_relation == "merged":
        print(f"Issue #{issue_num} PR has been merged. Closing the issue.")
        target_labels.discard("status:in-progress")
        target_labels.discard("status:in-review")
        github_utils.set_issue_labels(issue_num, list(target_labels))
        github_utils.run_cmd(["gh", "issue", "close", str(issue_num)])
        return

    if state_relation == "open_pr":
        target_labels.add("status:in-review")
        target_labels.discard("status:in-progress")
    elif state_relation == "branch_exists":
        target_labels.add("status:in-progress")
        target_labels.discard("status:in-review")
    else:
        target_labels.discard("status:in-progress")
        target_labels.discard("status:in-review")

    github_utils.set_issue_labels(issue_num, list(target_labels))
    print(f"Updated labels for #{issue_num} to: {target_labels}")


def main():
    print("Ensuring custom labels exist...")
    github_utils.ensure_labels_exist()

    issues = github_utils.list_issues(state="open")
    if not issues:
        print("No open issues to triage.")
        return

    for issue in issues:
        try:
            triage_issue(issue)
        except Exception as exc:
            print(f"Error triaging issue #{issue['number']}: {exc}")


if __name__ == "__main__":
    main()
