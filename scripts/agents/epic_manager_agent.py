import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import github_utils

from dotenv import load_dotenv

load_dotenv()

import pydantic
from pydantic import Field

from agent_config import agent_log, model_for_agent, timeout_for_agent
from agent_session import create_session_id, pick_primary_issue, with_fresh_session_instructions
from codebase_context import gather_codebase_context
from openrouter_client import chat_structured

EPIC_BREAKDOWN_TAG = "<!-- epic-manager-breakdown -->"
VALID_CHILD_TYPES = {"bug", "feature", "docs", "test", "refactor", "chore"}


class EpicChildIssue(pydantic.BaseModel):
    title: str
    issue_type: str = Field(description="One of: bug, feature, docs, test, refactor, chore")
    goal: str
    requirements: list[str] = Field(default_factory=list)
    technical_notes: str = ""
    acceptance_criteria: list[str] = Field(default_factory=list)
    rationale: str


class EpicBreakdown(pydantic.BaseModel):
    summary: str
    child_issues: list[EpicChildIssue] = Field(default_factory=list)


def labels_for(issue: dict) -> set[str]:
    return {label["name"] for label in issue.get("labels", [])}


def has_breakdown_comment(comments: list[dict]) -> bool:
    return any(EPIC_BREAKDOWN_TAG in (comment.get("body") or "") for comment in comments)


def format_child_body(epic_number: int, child: EpicChildIssue) -> str:
    requirements = child.requirements or [child.goal]
    acceptance = child.acceptance_criteria or [
        "The feature/bug slice can be verified independently from the rest of the epic."
    ]
    return "\n".join(
        [
            f"Part of Epic #{epic_number}.",
            "",
            "## Goal / Problem Description",
            child.goal.strip(),
            "",
            "## Proposed Changes / Requirements",
            *[f"- {item.strip()}" for item in requirements if item.strip()],
            "",
            "## Technical Notes / Context",
            child.technical_notes.strip() or "Keep this scoped to one high-level user-facing slice.",
            "",
            "## Acceptance Criteria",
            *[f"- {item.strip()}" for item in acceptance if item.strip()],
        ]
    )


def label_for_child(child: EpicChildIssue) -> list[str]:
    issue_type = child.issue_type.strip().lower()
    if issue_type not in VALID_CHILD_TYPES:
        issue_type = "feature"
    return [f"type:{issue_type}"]


def append_child_checklist(body: str, created_children: list[tuple[int, EpicChildIssue]]) -> str:
    lines = body.rstrip().splitlines()
    if lines and lines[-1].strip():
        lines.append("")
    lines.extend(["## Child Issues", ""])
    for child_number, child in created_children:
        lines.append(f"- [ ] #{child_number} {child.title.strip()}")
    return "\n".join(lines) + "\n"


def format_breakdown_comment(breakdown: EpicBreakdown, created_children: list[tuple[int, EpicChildIssue]]) -> str:
    lines = [
        EPIC_BREAKDOWN_TAG,
        "## Epic breakdown",
        "",
        breakdown.summary.strip(),
        "",
        "Created high-level child issues:",
    ]
    for child_number, child in created_children:
        lines.append(f"- #{child_number} {child.title.strip()} - {child.rationale.strip()}")
    return "\n".join(lines)


def build_prompt(issue_num: int, title: str, body: str, comments: str, codebase_context: str) -> str:
    return f"""
Break this epic into a suitable set of high-level child GitHub issues.

Epic #{issue_num}: {title}

Epic body:
{body}

Existing comments:
{comments}

Repository context:
{codebase_context}

Create 3-8 child issues unless the epic is genuinely smaller.

Good child issues are high-level feature or bug slices, for example:
- Add background fade transition between scenes
- Add actor fade transition between scenes
- Support importing a reusable scene transition preset

Do NOT create low-level implementation chores such as:
- Create database table
- Write unit tests
- Add CSS class
- Refactor helper
- Update docs only, unless documentation is the actual product deliverable

Each child issue must be independently useful, reviewable in one PR, and phrased around
product behavior or a coherent technical capability. Avoid duplicate children and avoid
splitting one feature into tiny mechanical steps.

Return JSON only.
"""


def process_issue(issue: dict) -> bool:
    issue_num = issue["number"]
    title = issue["title"]
    body = issue["body"] or ""

    agent_log(f"\n=======================================================")
    agent_log(f"Epic Manager picking up Issue #{issue_num}: {title}")
    agent_log(f"=======================================================")

    details = github_utils.get_issue_details(issue_num) or issue
    comments = details.get("comments", [])
    if has_breakdown_comment(comments):
        agent_log(f"Epic #{issue_num} already has an Epic Manager breakdown comment.")
        github_utils.update_issue_labels(issue_num, add_labels=["epic:planned"])
        return True

    comments_text = []
    for comment in comments:
        author = comment.get("author", {}).get("login", "unknown")
        comment_body = comment.get("body", "")
        comments_text.append(f"Comment by {author}:\n{comment_body}\n")

    codebase_context = gather_codebase_context(title, body)
    breakdown = chat_structured(
        model=model_for_agent("epic"),
        system=with_fresh_session_instructions(
            "You are an expert Epic Manager for the MuseLab backlog. "
            "Break epics into coherent high-level feature or bug slices, not implementation chores."
        ),
        user=build_prompt(issue_num, title, body, "\n---\n".join(comments_text), codebase_context),
        response_model=EpicBreakdown,
        temperature=0.2,
        session_id=create_session_id("epic", issue_num),
        timeout_seconds=timeout_for_agent("epic"),
    )

    children = [child for child in breakdown.child_issues if child.title.strip()]
    if not children:
        agent_log(f"Epic Manager produced no child issues for #{issue_num}.")
        github_utils.add_issue_comment(
            issue_num,
            f"{EPIC_BREAKDOWN_TAG}\nNo suitable high-level child issues were identified.",
        )
        github_utils.update_issue_labels(issue_num, add_labels=["needs:human"])
        return False

    created_children: list[tuple[int, EpicChildIssue]] = []
    for child in children:
        child_number = github_utils.create_github_issue(
            child.title.strip(),
            format_child_body(issue_num, child),
            labels=label_for_child(child),
        )
        if child_number:
            github_utils.add_sub_issue(issue_num, child_number)
            created_children.append((int(child_number), child))
            agent_log(f"Created child issue #{child_number}: {child.title}")

    if not created_children:
        agent_log(f"Failed to create any child issues for epic #{issue_num}.")
        return False

    github_utils.update_issue_body(issue_num, append_child_checklist(body, created_children))
    github_utils.add_issue_comment(issue_num, format_breakdown_comment(breakdown, created_children))
    github_utils.update_issue_labels(issue_num, add_labels=["epic:planned"])
    agent_log(f"Epic #{issue_num} broken down into {len(created_children)} child issue(s).")
    return True


def main() -> None:
    raw_issue_number = sys.argv[1].strip() if len(sys.argv) > 1 else ""
    target_issue_number = int(raw_issue_number) if raw_issue_number else None

    github_utils.ensure_labels_exist()
    issues = github_utils.list_issues(state="open")
    if target_issue_number is not None:
        issues = [issue for issue in issues if issue["number"] == target_issue_number]
    issues = github_utils.filter_project_todo_issues(issues)

    eligible_issues = []
    for issue in issues:
        labels = labels_for(issue)
        if "epic" in labels and "epic:planned" not in labels and "needs:human" not in labels:
            eligible_issues.append(issue)

    if not eligible_issues:
        if target_issue_number is None:
            agent_log("No eligible epics found for Epic Manager.")
        else:
            agent_log(f"Issue #{target_issue_number} is not eligible for Epic Manager.")
        return

    agent_log(f"Found {len(eligible_issues)} eligible epic(s); processing one fresh session per run.")
    issue = pick_primary_issue(eligible_issues)
    if issue:
        process_issue(issue)


if __name__ == "__main__":
    main()
