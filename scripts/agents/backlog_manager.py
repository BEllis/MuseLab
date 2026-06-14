"""Backlog manager triage aligned with neo backlog-manager skill (apply mode only)."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field

import pydantic
from pydantic import Field

import github_utils
from agent_config import model_for_agent, timeout_for_agent, resolve_repo_root
from agent_session import create_session_id, with_fresh_session_instructions
from openrouter_client import chat_structured

AGENT_ASSESSMENT_TAG = "<!-- agent-assessment -->"
CONFORMANCE_WARNING_TAG = "<!-- conformance-warning -->"
LABEL_DECISION_TAG = "<!-- label-decision -->"

MANAGED_RISK_LABELS = ("risk:low", "risk:medium", "risk:high")
MANAGED_TYPE_LABELS = (
    "type:bug",
    "type:feature",
    "type:docs",
    "type:test",
    "type:refactor",
    "type:chore",
)
MANAGED_ROUTING_LABELS = (
    "agent:ready",
    "needs:human",
    "agent:investigate",
    "human:ready",
    "human:investigate",
)
STATUS_LABELS = ("status:in-progress", "status:in-review")

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
    "workstream",
    "platform",
)

CONDITIONAL_PATTERNS = (
    "if built",
    "if we build",
    "whether to",
    "decide between",
    "go/no-go",
    "tracks under #",
)


class BacklogClassification(pydantic.BaseModel):
    conforms: bool
    missing_sections: list[str] = Field(default_factory=list)
    risk: str
    issue_type: str
    routing: str
    issue_shape: str
    recommend_epic: bool
    agent_ready: bool
    reason: str
    suggested_plan: list[str] = Field(default_factory=list)
    human_needed: str = ""
    needs_product_input: bool = False


@dataclass
class RunReport:
    issues_inspected: int = 0
    labels_added: list[str] = field(default_factory=list)
    label_decision_comments: int = 0
    assessments_updated: int = 0
    conformance_warnings: int = 0
    issues_closed: int = 0
    project_status_updates: int = 0
    agent_ready_marked: int = 0
    needs_human_marked: int = 0
    agent_investigate_marked: int = 0
    epics_marked: int = 0
    epic_routing_corrections: int = 0
    label_disagreements: list[str] = field(default_factory=list)
    blockers: list[str] = field(default_factory=list)


def load_repo_context() -> str:
    repo_root = resolve_repo_root()
    parts: list[str] = []
    for rel_path in ("README.md", "CONTRIBUTING.md", "docs/PROJECT_STATUS.md"):
        path = os.path.join(repo_root, rel_path)
        if not os.path.isfile(path):
            continue
        with open(path, encoding="utf-8", errors="replace") as handle:
            content = handle.read(8000)
        parts.append(f"## {rel_path}\n{content}")
    return "\n\n".join(parts) if parts else "(no repo context files found)"


def infer_issue_type_from_title(title: str) -> str | None:
    upper = title.upper()
    if "[BUG]" in upper or upper.startswith("BUG"):
        return "bug"
    if "[DOCS]" in upper or "DOCUMENTATION" in upper:
        return "docs"
    if "[TEST]" in upper:
        return "test"
    if "[REFACTOR]" in upper:
        return "refactor"
    if "[CHORE]" in upper:
        return "chore"
    if any(prefix in upper for prefix in ("[FEATURE", "[TASK", "[EPIC]")):
        return "feature"
    return None


def build_classification_prompt(
    title: str,
    body: str,
    current_labels: set[str],
    repo_context: str,
) -> str:
    label_summary = ", ".join(sorted(current_labels)) if current_labels else "(none)"
    return f"""
Classify this GitHub issue for the MuseLab backlog manager.

Repository context:
{repo_context}

Issue Title: {title}
Current Labels: {label_summary}
Issue Body:
{body}

Use the backlog-manager contract:

## Managed labels (only suggest labels from this set)
Risk: risk:low | risk:medium | risk:high
Type: type:bug | type:feature | type:docs | type:test | type:refactor | type:chore
Routing: agent:ready | needs:human | agent:investigate | none

## Conformance
- Bugs need: Description, Steps to Reproduce, Expected Behavior, Actual Behavior, Environment Info
- Features/tasks need: Goal / Problem Description, Proposed Changes / Requirements, Technical Notes / Context
- Epics should use Goal, Background / Context, Tasks checklist, Acceptance Criteria

## Issue shape (issue_shape)
- single_task: one bounded deliverable suitable for one PR
- epic: multiple independent deliverables/workstreams (each may be its own epic)
- research_spike: investigation, evaluation, or consultation before implementation

## Epic detection (recommend_epic)
Set recommend_epic=true when ANY apply:
- Requirements list 2+ independent deliverables (engines, plugins, platforms, workstreams)
- Work spans multiple engines, platforms, integrations, or major subsystems
- The issue describes a roadmap initiative rather than one implementation change
- Technical notes defer work, require evaluation first, or conditional build ("if built...")
- The issue tracks under a deferred/future initiative epic (e.g. "Tracks under #7")
- Title uses [EPIC] or the body describes separate epics per deliverable

Set needs_product_input=true when maintainers/users must decide direction, priority,
or go/no-go before agents proceed.

## Routing rules
agent:ready ONLY when ALL are true:
- risk is low
- issue_shape is single_task
- scope is clear and small enough for one PR
- expected output and verification are clear
- no product, UX, architecture, security, or strategic judgement required
- not deferred or conditional ("if built", "evaluate demand first")

needs:human when ANY are true:
- requirements ambiguous or strategic
- needs maintainer/product/user consultation
- too large for one PR without breakdown
- deferred initiative or go/no-go decision pending
- recommend_epic with no task breakdown yet
- needs_product_input is true
- human_needed text is non-empty

NEVER set agent:ready when issue_shape is epic or research_spike, when recommend_epic is true,
when needs_product_input is true, or when requirements are conditional/deferred.

agent:investigate when:
- codebase research or options analysis is needed AND an agent can do the spike
- research_spike without mandatory human product decision first

none when:
- already well labeled by a human and no new routing recommendation is warranted

Set agent_ready=true only when routing would be agent:ready.

Return JSON. Be conservative: prefer needs:human or agent:investigate over agent:ready.
"""


def apply_classification_overrides(
    title: str,
    body: str,
    classification: BacklogClassification,
) -> BacklogClassification:
    text = f"{title}\n{body}".lower()
    data = classification.model_dump()

    if title.upper().startswith("[EPIC]"):
        data["issue_shape"] = "epic"
        data["recommend_epic"] = True
        data["agent_ready"] = False
        if data["routing"] == "agent:ready":
            data["routing"] = "needs:human"

    inferred = infer_issue_type_from_title(title)
    if inferred and data["issue_type"] not in {
        "bug",
        "feature",
        "docs",
        "test",
        "refactor",
        "chore",
    }:
        data["issue_type"] = inferred

    if any(pattern in text for pattern in DEFER_PATTERNS):
        data["issue_shape"] = "research_spike"
        data["recommend_epic"] = True
        data["needs_product_input"] = True
        data["routing"] = "needs:human"
        data["agent_ready"] = False
        if not data["human_needed"]:
            data["human_needed"] = (
                "Deferred or strategic initiative — confirm priority and whether to break "
                "into epics before any agent implementation."
            )

    if any(pattern in text for pattern in CONDITIONAL_PATTERNS):
        if data["issue_shape"] == "single_task":
            data["issue_shape"] = "research_spike"
        data["needs_product_input"] = True
        if data["routing"] == "agent:ready":
            data["routing"] = "needs:human"
            data["agent_ready"] = False

    if any(pattern in text for pattern in RESEARCH_PATTERNS):
        if data["issue_shape"] == "single_task":
            data["issue_shape"] = "research_spike"
        if data["routing"] == "agent:ready":
            data["routing"] = (
                "needs:human"
                if data.get("needs_product_input") or data.get("human_needed")
                else "agent:investigate"
            )
            data["agent_ready"] = False

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

    if data.get("needs_product_input") and not data.get("human_needed"):
        data["human_needed"] = (
            "Product or maintainer input required before planning or implementation."
        )

    if data.get("recommend_epic") and data["routing"] == "agent:ready":
        data["routing"] = (
            "needs:human" if data.get("needs_product_input") else "agent:investigate"
        )
        data["agent_ready"] = False

    if data.get("issue_shape") == "epic" and data["routing"] == "agent:ready":
        data["routing"] = (
            "needs:human" if data.get("needs_product_input") else "agent:investigate"
        )
        data["agent_ready"] = False

    if data.get("issue_shape") == "research_spike" and data["routing"] == "agent:ready":
        data["routing"] = (
            "needs:human" if data.get("needs_product_input") else "agent:investigate"
        )
        data["agent_ready"] = False

    if data.get("recommend_epic") or data.get("issue_shape") in {"epic", "research_spike"}:
        if data["routing"] == "agent:ready":
            data["routing"] = (
                "needs:human" if data.get("needs_product_input") else "agent:investigate"
            )
            data["agent_ready"] = False

    if data["routing"] == "agent:ready":
        if data["risk"] != "low" or data["issue_shape"] != "single_task":
            data["routing"] = "agent:investigate"
            data["agent_ready"] = False

    if data["routing"] == "agent:ready" and not data["agent_ready"]:
        data["routing"] = "agent:investigate"

    if data["risk"] == "high" and data["routing"] not in {"needs:human", "none"}:
        if data["routing"] == "agent:ready":
            data["routing"] = "needs:human"
            data["agent_ready"] = False

    return BacklogClassification.model_validate(data)


def format_agent_assessment(classification: BacklogClassification) -> str:
    plan_lines = classification.suggested_plan[:3]
    while len(plan_lines) < 3:
        plan_lines.append("Verify the change with the project's standard test/build commands.")

    lines = [
        AGENT_ASSESSMENT_TAG,
        "## Agent Assessment",
        "",
        f"Risk: {classification.risk}",
        f"Type: {classification.issue_type}",
        f"Issue shape: {classification.issue_shape}",
        f"Agent-ready: {'yes' if classification.agent_ready else 'no'}",
        "",
        "Reason:",
        classification.reason,
        "",
        "Suggested plan:",
    ]
    for index, step in enumerate(plan_lines[:3], start=1):
        lines.append(f"{index}. {step}")

    if classification.recommend_epic:
        lines.extend(
            [
                "",
                "Epic guidance:",
                "- This looks like an **epic**, not a single implementation task.",
                "- Convert to `[EPIC]` with a `## Tasks` checklist.",
                "- Split engines/platforms/workstreams into child issues or nested epics.",
                "- Keep research/evaluation separate from build tasks.",
            ]
        )

    if classification.issue_shape == "research_spike" or classification.needs_product_input:
        lines.extend(
            [
                "",
                "Research / product input:",
                "- Needs investigation and/or maintainer/user consultation before implementation.",
                "- Do not route straight to design or implement until direction is decided.",
            ]
        )

    if classification.human_needed.strip():
        lines.extend(["", "Human needed:", classification.human_needed.strip()])

    return "\n".join(lines)


def find_tagged_comment(comments: list[dict], tag: str) -> dict | None:
    for comment in comments:
        if tag in (comment.get("body") or ""):
            return comment
    return None


def normalize_assessment_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def label_decision_reason(label: str, classification: BacklogClassification) -> str:
    if label.startswith("risk:"):
        return (
            f"`{label}` because the issue was assessed as `{classification.risk}` risk. "
            f"{classification.reason}"
        )
    if label.startswith("type:"):
        return (
            f"`{label}` because the work fits the `{classification.issue_type}` category. "
            f"{classification.reason}"
        )
    if label in MANAGED_ROUTING_LABELS:
        return (
            f"`{label}` because the routing decision is `{classification.routing}`. "
            f"{classification.reason}"
        )
    if label == "epic":
        return (
            "`epic` because the issue appears to span multiple deliverables, requires "
            "breakdown, or needs research/product input before implementation."
        )
    if label.startswith("priority:") or label.startswith("value:"):
        return f"`{label}` based on triage assessment. {classification.reason}"
    return f"`{label}` based on triage assessment. {classification.reason}"


def post_label_decision_comment(
    issue_num: int,
    labels_added: list[str],
    classification: BacklogClassification,
    report: RunReport,
) -> None:
    if not labels_added:
        return

    lines = [
        LABEL_DECISION_TAG,
        "## Triage label decision",
        "",
        "I added the following label(s):",
    ]
    for label in labels_added:
        lines.append(f"- {label_decision_reason(label, classification)}")

    if github_utils.add_issue_comment(issue_num, "\n".join(lines)):
        report.label_decision_comments += 1


def sync_epic_checklist(issue_num: int, body: str) -> str:
    checklist_pattern = re.compile(r'^(\s*[-*]\s*\[\s*[ xX]?\s*\]\s*)(.+)$', re.MULTILINE)
    updated_lines = []
    body_changed = False

    for line in body.splitlines():
        match = checklist_pattern.match(line)
        if match:
            prefix = match.group(1)
            task_text = match.group(2).strip()
            issue_refs = [int(item) for item in re.findall(r"#\s*(\d+)", task_text)]
            if issue_refs:
                for child_issue_num in issue_refs:
                    if child_issue_num != issue_num:
                        github_utils.add_sub_issue(issue_num, child_issue_num)
            elif "issues/" not in task_text:
                print(f"Epic #{issue_num}: creating sub-issue for checklist item '{task_text}'")
                sub_issue_num = github_utils.create_github_issue(
                    f"[SUB-TASK] {task_text}",
                    f"Part of Epic #{issue_num}.",
                )
                if sub_issue_num:
                    github_utils.add_sub_issue(issue_num, sub_issue_num)
                    status_char = "x" if "x" in prefix.lower() else " "
                    list_bullet = "-" if "-" in prefix else "*"
                    leading_ws = prefix[: prefix.find(list_bullet)]
                    line = (
                        f"{leading_ws}{list_bullet} [{status_char}] "
                        f"#{sub_issue_num} {task_text}"
                    )
                    body_changed = True
        updated_lines.append(line)

    if not body_changed:
        return body

    new_body = "\n".join(updated_lines)
    github_utils.update_issue_body(issue_num, new_body)
    return new_body


def sync_declared_epic_parent_links(issue_num: int, body: str) -> None:
    """Links issues that declare an epic parent in their body as actual sub-issues."""
    parent_patterns = (
        r"Tracks under\s+#\s*(\d+)",
        r"Part of Epic\s+#\s*(\d+)",
    )
    parent_numbers: set[int] = set()
    for pattern in parent_patterns:
        parent_numbers.update(int(item) for item in re.findall(pattern, body, re.IGNORECASE))

    for parent_issue_num in sorted(parent_numbers):
        if parent_issue_num != issue_num:
            github_utils.add_sub_issue(parent_issue_num, issue_num)


def classify_issue(
    title: str,
    body: str,
    current_labels: set[str],
    repo_context: str,
    issue_num: int,
) -> BacklogClassification:
    session_id = create_session_id("triage", issue_num)
    print(f"Starting fresh classification session: {session_id}")
    result = chat_structured(
        model=model_for_agent("triage"),
        system=with_fresh_session_instructions(
            "You are the MuseLab backlog manager. Classify issues using a small fixed label "
            "set, prefer conservative routing, and write practical suggested plans."
        ),
        user=build_classification_prompt(title, body, current_labels, repo_context),
        response_model=BacklogClassification,
        session_id=session_id,
        timeout_seconds=timeout_for_agent("triage"),
    )
    return apply_classification_overrides(title, body, result)


def note_label_disagreements(
    issue_num: int,
    current_labels: set[str],
    classification: BacklogClassification,
    report: RunReport,
) -> None:
    existing_risk = next((label for label in current_labels if label in MANAGED_RISK_LABELS), None)
    if existing_risk and existing_risk != f"risk:{classification.risk}":
        report.label_disagreements.append(
            f"#{issue_num}: existing {existing_risk} vs suggested risk:{classification.risk}"
        )

    existing_type = next((label for label in current_labels if label in MANAGED_TYPE_LABELS), None)
    expected_type = f"type:{classification.issue_type}"
    if existing_type and existing_type != expected_type:
        report.label_disagreements.append(
            f"#{issue_num}: existing {existing_type} vs suggested {expected_type}"
        )

    existing_routing = next((label for label in current_labels if label in MANAGED_ROUTING_LABELS), None)
    if (
        existing_routing
        and classification.routing != "none"
        and existing_routing != classification.routing
    ):
        report.label_disagreements.append(
            f"#{issue_num}: existing {existing_routing} vs suggested {classification.routing}"
        )


def apply_managed_labels_additively(
    issue_num: int,
    current_labels: set[str],
    classification: BacklogClassification,
    report: RunReport,
) -> set[str]:
    note_label_disagreements(issue_num, current_labels, classification, report)
    labels_to_add: list[str] = []

    if not any(label in current_labels for label in MANAGED_RISK_LABELS):
        labels_to_add.append(f"risk:{classification.risk}")

    if not any(label in current_labels for label in MANAGED_TYPE_LABELS):
        labels_to_add.append(f"type:{classification.issue_type}")

    has_routing = any(label in current_labels for label in MANAGED_ROUTING_LABELS)
    if not has_routing and classification.routing != "none":
        labels_to_add.append(classification.routing)

    if classification.recommend_epic:
        labels_to_add.append("epic")

    if labels_to_add:
        if github_utils.update_issue_labels(issue_num, add_labels=labels_to_add):
            report.labels_added.extend(f"#{issue_num}:{label}" for label in labels_to_add)
            post_label_decision_comment(issue_num, labels_to_add, classification, report)

    updated = set(current_labels)
    updated.update(labels_to_add)
    if "epic" in updated:
        report.epics_marked += 1
    return updated


def is_epic_candidate(
    title: str,
    labels: set[str],
    classification: BacklogClassification,
) -> bool:
    return (
        "epic" in labels
        or title.upper().startswith("[EPIC]")
        or classification.recommend_epic
        or classification.issue_shape in {"epic", "research_spike"}
    )


def resolve_epic_routing(classification: BacklogClassification) -> str:
    if classification.routing not in {"none", "agent:ready"}:
        return classification.routing
    if classification.needs_product_input or classification.human_needed.strip():
        return "needs:human"
    return "agent:investigate"


def enforce_epic_routing_labels(
    issue_num: int,
    current_labels: set[str],
    title: str,
    classification: BacklogClassification,
    report: RunReport,
) -> set[str]:
    """Epics and research-first tickets must not keep agent:ready / agent:planned."""
    if not is_epic_candidate(title, current_labels, classification):
        return current_labels

    labels = set(current_labels)
    removes: list[str] = []
    adds: list[str] = []

    for blocked in ("agent:ready", "agent:planned"):
        if blocked in labels:
            removes.append(blocked)
            labels.discard(blocked)

    target_routing = resolve_epic_routing(classification)
    existing_routing = [
        label for label in labels if label in MANAGED_ROUTING_LABELS
    ]
    if target_routing in MANAGED_ROUTING_LABELS:
        for routing_label in existing_routing:
            if routing_label != target_routing:
                removes.append(routing_label)
                labels.discard(routing_label)
        if target_routing not in labels:
            adds.append(target_routing)
            labels.add(target_routing)

    if not removes and not adds:
        return current_labels

    labels_updated = github_utils.update_issue_labels(
        issue_num,
        add_labels=adds or None,
        remove_labels=removes or None,
    )
    if labels_updated and adds:
        report.labels_added.extend(f"#{issue_num}:{label}" for label in adds)
        post_label_decision_comment(issue_num, adds, classification, report)
    report.epic_routing_corrections += 1
    return labels


def sync_issue_with_pull_requests(
    issue_num: int,
    current_labels: set[str],
    pr_state: str,
    report: RunReport,
) -> set[str]:
    labels = set(current_labels)
    removes: list[str] = []
    adds: list[str] = []

    if pr_state == "merged":
        removes.extend(label for label in ("agent:ready", "agent:planned") if label in labels)
        labels.difference_update(removes)
        for status_label in STATUS_LABELS:
            if status_label in labels:
                removes.append(status_label)
                labels.discard(status_label)
        if removes:
            github_utils.update_issue_labels(issue_num, remove_labels=removes)
        github_utils.run_cmd(["gh", "issue", "close", str(issue_num)])
        report.issues_closed += 1
        return labels

    if pr_state == "open_pr":
        removes.extend(label for label in ("agent:ready", "agent:planned") if label in labels)
        if "status:in-progress" in labels:
            removes.append("status:in-progress")
            labels.discard("status:in-progress")
        if "status:in-review" not in labels:
            adds.append("status:in-review")
            labels.add("status:in-review")
    elif pr_state == "branch_exists":
        removes.extend(label for label in ("agent:ready", "agent:planned") if label in labels)
        if "status:in-review" in labels:
            removes.append("status:in-review")
            labels.discard("status:in-review")
        if "status:in-progress" not in labels:
            adds.append("status:in-progress")
            labels.add("status:in-progress")
    else:
        removes.extend(label for label in STATUS_LABELS if label in labels)
        labels.difference_update(label for label in STATUS_LABELS if label in removes)

    if removes or adds:
        github_utils.update_issue_labels(
            issue_num,
            add_labels=adds or None,
            remove_labels=removes or None,
        )
    return labels


def project_status_for_pr_state(pr_state: str) -> str:
    if pr_state == "merged":
        return github_utils.PROJECT_DONE_STATUS
    if pr_state in {"open_pr", "branch_exists"}:
        return github_utils.PROJECT_IN_PROGRESS_STATUS
    return github_utils.PROJECT_TODO_STATUS


def sync_issue_project_status(issue_num: int, pr_state: str, report: RunReport) -> None:
    if github_utils.update_project_issue_status(
        issue_num,
        project_status_for_pr_state(pr_state),
    ):
        report.project_status_updates += 1


def maybe_post_conformance_warning(
    issue_num: int,
    is_epic: bool,
    classification: BacklogClassification,
    comments: list[dict],
    report: RunReport,
) -> None:
    if is_epic or classification.conforms:
        return
    if find_tagged_comment(comments, CONFORMANCE_WARNING_TAG):
        return
    missing_list = ", ".join(f"`{item}`" for item in classification.missing_sections)
    github_utils.add_issue_comment(
        issue_num,
        f"""{CONFORMANCE_WARNING_TAG}
Hi! Thanks for creating this issue. It does not fully match our issue template.
Please add the missing sections: {missing_list}.
""",
    )
    report.conformance_warnings += 1


def maybe_post_agent_assessment(
    issue_num: int,
    classification: BacklogClassification,
    comments: list[dict],
    report: RunReport,
) -> None:
    assessment = format_agent_assessment(classification)
    existing = find_tagged_comment(comments, AGENT_ASSESSMENT_TAG)
    if existing and normalize_assessment_text(existing.get("body", "")) == normalize_assessment_text(
        assessment
    ):
        return
    if existing and existing.get("id"):
        if github_utils.edit_issue_comment(existing["id"], assessment):
            report.assessments_updated += 1
        return
    if github_utils.add_issue_comment(issue_num, assessment):
        report.assessments_updated += 1


def triage_issue(issue: dict, repo_context: str, status_info: dict, report: RunReport) -> None:
    issue_num = issue["number"]
    title = issue["title"]
    body = issue["body"] or ""
    current_labels = {label["name"] for label in issue.get("labels", [])}

    print(f"\n--- Backlog review for Issue #{issue_num}: {title} ---")
    report.issues_inspected += 1

    is_labeled_epic = "epic" in current_labels or title.upper().startswith("[EPIC]")
    if is_labeled_epic:
        body = sync_epic_checklist(issue_num, body)
    else:
        sync_declared_epic_parent_links(issue_num, body)

    classification = classify_issue(title, body, current_labels, repo_context, issue_num)
    print(f"Classification: {classification.model_dump()}")

    if is_epic_candidate(title, current_labels, classification):
        refreshed = github_utils.get_issue_details(issue_num)
        if refreshed:
            body = refreshed.get("body") or body
        body = sync_epic_checklist(issue_num, body)

    details = github_utils.get_issue_details(issue_num) or issue
    comments = details.get("comments", [])

    maybe_post_conformance_warning(
        issue_num,
        is_labeled_epic or classification.recommend_epic,
        classification,
        comments,
        report,
    )
    maybe_post_agent_assessment(issue_num, classification, comments, report)

    updated_labels = apply_managed_labels_additively(
        issue_num, current_labels, classification, report
    )
    updated_labels = enforce_epic_routing_labels(
        issue_num, updated_labels, title, classification, report
    )

    pr_state = github_utils.get_issue_relations(issue_num, status_info)
    updated_labels = sync_issue_with_pull_requests(
        issue_num, updated_labels, pr_state, report
    )
    sync_issue_project_status(issue_num, pr_state, report)

    if "agent:ready" in updated_labels:
        report.agent_ready_marked += 1
    if "needs:human" in updated_labels:
        report.needs_human_marked += 1
    if "agent:investigate" in updated_labels:
        report.agent_investigate_marked += 1

    print(f"Updated labels for #{issue_num}: {sorted(updated_labels)}")


def print_run_report(report: RunReport) -> None:
    print("\n=== Backlog Manager Run Report ===")
    print(f"Issues inspected: {report.issues_inspected}")
    print(f"Labels added: {len(report.labels_added)}")
    print(f"Label decision comments posted: {report.label_decision_comments}")
    print(f"Agent assessments updated: {report.assessments_updated}")
    print(f"Conformance warnings posted: {report.conformance_warnings}")
    print(f"Issues closed from merged PRs: {report.issues_closed}")
    print(f"Project status updates: {report.project_status_updates}")
    print(f"Issues marked agent:ready: {report.agent_ready_marked}")
    print(f"Issues marked needs:human: {report.needs_human_marked}")
    print(f"Issues marked agent:investigate: {report.agent_investigate_marked}")
    print(f"Epics marked: {report.epics_marked}")
    print(f"Epic routing corrections: {report.epic_routing_corrections}")
    if report.label_disagreements:
        print("Label disagreements (existing labels kept):")
        for item in report.label_disagreements:
            print(f"  - {item}")
    if report.blockers:
        print("Blockers:")
        for blocker in report.blockers:
            print(f"  - {blocker}")
    print("Mode: apply")
    print("Recommended next action: review needs:human items and agent:investigate queue")


def run_backlog_triage(issue_number: int | None = None) -> int:
    print("Ensuring backlog labels exist...")
    if not github_utils.ensure_labels_exist():
        print("Failed to ensure labels exist.")
        return 1

    issues = github_utils.list_issues(state="open")
    if issue_number is not None:
        issues = [issue for issue in issues if issue["number"] == issue_number]

    if not issues:
        if issue_number is None:
            print("No open issues to triage.")
        else:
            print(f"No open issue found for triage issue #{issue_number}.")
        return 0

    repo_context = load_repo_context()
    status_info = github_utils.get_codebase_status()
    report = RunReport()

    for issue in issues:
        try:
            triage_issue(issue, repo_context, status_info, report)
        except Exception as exc:
            message = f"Issue #{issue['number']}: {exc}"
            print(f"Error triaging issue #{issue['number']}: {exc}")
            report.blockers.append(message)

    print_run_report(report)
    return 0 if not report.blockers else 1
