#!/usr/bin/env python3
"""Report the next issue number that has work for a pipeline agent."""

from __future__ import annotations

import sys

import github_utils

AGENT_ASSESSMENT_TAG = "<!-- agent-assessment -->"

MANAGED_RISK_LABELS = {"risk:low", "risk:medium", "risk:high"}
MANAGED_TYPE_LABELS = {
    "type:bug",
    "type:feature",
    "type:docs",
    "type:test",
    "type:refactor",
    "type:chore",
}


def labels_for(issue: dict) -> set[str]:
    return {label["name"] for label in issue.get("labels", [])}


def has_agent_assessment(issue_number: int) -> bool:
    details = github_utils.get_issue_details(issue_number)
    if not details:
        return False
    for comment in details.get("comments", []):
        if AGENT_ASSESSMENT_TAG in (comment.get("body") or ""):
            return True
    return False


def triage_has_work(issue: dict) -> bool:
    labels = labels_for(issue)
    has_core_labels = (
        bool(labels & MANAGED_RISK_LABELS)
        and bool(labels & MANAGED_TYPE_LABELS)
    )
    return not has_core_labels or not has_agent_assessment(issue["number"])


def investigate_has_work(issue: dict, status_info: dict) -> bool:
    labels = labels_for(issue)
    return (
        "agent:investigate" in labels
        and not github_utils.has_unresolved_dependencies(issue)
        and github_utils.get_issue_relations(issue["number"], status_info) == "none"
    )


def epic_has_work(issue: dict) -> bool:
    labels = labels_for(issue)
    return (
        "epic" in labels
        and "epic:planned" not in labels
        and "needs:human" not in labels
    )


def dependency_has_work(issue: dict) -> bool:
    labels = labels_for(issue)
    return "epic" not in labels and not github_utils.dependency_assessment_exists(issue)


def design_has_work(issue: dict) -> bool:
    labels = labels_for(issue)
    return (
        "agent:ready" in labels
        and "agent:planned" not in labels
        and "epic" not in labels
        and "needs:human" not in labels
        and "agent:investigate" not in labels
        and not github_utils.has_unresolved_dependencies(issue)
    )


def implement_has_work(issue: dict, status_info: dict) -> bool:
    labels = labels_for(issue)
    return (
        "agent:ready" in labels
        and "plan:signoff" in labels
        and "epic" not in labels
        and not github_utils.has_unresolved_dependencies(issue)
        and github_utils.get_issue_relations(issue["number"], status_info) == "none"
    )


def next_issue_number(agent_name: str) -> int | None:
    issues = sorted(github_utils.list_issues(state="open"), key=lambda issue: issue["number"])
    if not issues:
        return None

    if agent_name != "triage":
        issues = github_utils.filter_project_todo_issues(issues)
        if not issues:
            return None

    status_info = None
    if agent_name in {"investigate", "implement"}:
        status_info = github_utils.get_codebase_status()

    for issue in issues:
        if agent_name == "triage" and triage_has_work(issue):
            return issue["number"]
        if agent_name == "epic" and epic_has_work(issue):
            return issue["number"]
        if agent_name == "dependency" and dependency_has_work(issue):
            return issue["number"]
        if agent_name == "investigate" and investigate_has_work(issue, status_info or {}):
            return issue["number"]
        if agent_name == "design" and design_has_work(issue):
            return issue["number"]
        if agent_name == "implement" and implement_has_work(issue, status_info or {}):
            return issue["number"]
    return None


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: agent_work.py <triage|epic|dependency|investigate|design|implement>", file=sys.stderr)
        return 2

    issue_number = next_issue_number(sys.argv[1])
    print(issue_number if issue_number is not None else "none")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
