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


class IssueDependency(pydantic.BaseModel):
    issue_number: int
    reason: str


class DependencyAssessment(pydantic.BaseModel):
    has_dependencies: bool
    summary: str
    dependencies: list[IssueDependency] = Field(default_factory=list)


def labels_for(issue: dict) -> set[str]:
    return {label["name"] for label in issue.get("labels", [])}


def build_issue_catalog(issues: list[dict], current_number: int) -> str:
    lines = []
    for issue in sorted(issues, key=lambda item: item["number"]):
        if issue["number"] == current_number:
            continue
        labels = ", ".join(sorted(label["name"] for label in issue.get("labels", [])))
        lines.append(f"- #{issue['number']}: {issue['title']} [{labels}]")
    return "\n".join(lines) if lines else "(no other open issues)"


def build_prompt(issue: dict, issue_catalog: str, codebase_context: str) -> str:
    issue_num = issue["number"]
    title = issue["title"]
    body = issue.get("body") or ""
    return f"""
Analyze whether this issue must wait for other issues to be completed first.

Issue #{issue_num}: {title}

Issue body:
{body}

Other open issues in the repository:
{issue_catalog}

Repository context:
{codebase_context}

Rules:
- Only declare a dependency when another issue must be completed first for this work to make sense.
- Prefer concrete technical or product sequencing dependencies, not vague "related work".
- Do not depend on epics themselves; depend on specific child issues when needed.
- Do not depend on the same issue (#{issue_num}).
- If there is no real blocker, set has_dependencies=false and return an empty dependencies list.
- Each dependency must reference an existing open issue number from the catalog above.
- Keep reasons short and specific.

Examples of valid dependencies:
- Scene transition work depends on base scene navigation being implemented first.
- Export workflow depends on validation tooling existing first.

Examples of invalid dependencies:
- "Nice to have after" polish with no hard blocker.
- Depends on an epic umbrella issue instead of a concrete deliverable.
"""


def validate_dependencies(
    dependencies: list[IssueDependency],
    open_numbers: set[int],
    current_number: int,
) -> list[dict]:
    validated = []
    seen = set()
    for dependency in dependencies:
        issue_number = int(dependency.issue_number)
        if issue_number == current_number or issue_number not in open_numbers:
            continue
        if issue_number in seen:
            continue
        reason = dependency.reason.strip()
        if not reason:
            continue
        seen.add(issue_number)
        validated.append({"issue_number": issue_number, "reason": reason})
    return validated


def format_dependency_comment(assessment: DependencyAssessment, dependencies: list[dict]) -> str:
    lines = [
        github_utils.DEPENDENCY_COMMENT_TAG,
        "## Dependency assessment",
        "",
        assessment.summary.strip(),
    ]
    if dependencies:
        lines.extend(["", "Blocking dependencies:"])
        for dependency in dependencies:
            lines.append(
                f"- #{dependency['issue_number']}: {dependency['reason']}"
            )
        lines.extend(
            [
                "",
                "Investigation, design, and implementation agents will skip this issue "
                "until the dependencies above are completed.",
            ]
        )
    else:
        lines.extend(["", "No blocking dependencies were identified."])
    return "\n".join(lines)


def process_issue(issue: dict, all_open_issues: list[dict]) -> bool:
    issue_num = issue["number"]
    title = issue["title"]
    body = issue.get("body") or ""

    agent_log(f"\n=======================================================")
    agent_log(f"Dependency Tracker picking up Issue #{issue_num}: {title}")
    agent_log(f"=======================================================")

    if github_utils.dependency_assessment_exists(issue):
        agent_log(f"Issue #{issue_num} already has a dependency assessment.")
        return True

    open_numbers = {item["number"] for item in all_open_issues}
    codebase_context = gather_codebase_context(title, body)
    assessment = chat_structured(
        model=model_for_agent("dependency"),
        system=with_fresh_session_instructions(
            "You are an expert dependency tracker for a software backlog. "
            "Identify only real completion-order blockers between issues."
        ),
        user=build_prompt(issue, build_issue_catalog(all_open_issues, issue_num), codebase_context),
        response_model=DependencyAssessment,
        temperature=0.1,
        session_id=create_session_id("dependency", issue_num),
        timeout_seconds=timeout_for_agent("dependency"),
    )

    dependencies = []
    if assessment.has_dependencies:
        dependencies = validate_dependencies(
            assessment.dependencies,
            open_numbers,
            issue_num,
        )

    comment = format_dependency_comment(assessment, dependencies)
    if not github_utils.add_issue_comment(issue_num, comment):
        return False

    if dependencies:
        updated_body = github_utils.upsert_dependency_section(body, dependencies)
    else:
        updated_body = github_utils.append_dependency_assessment_marker(body)

    if updated_body != body:
        github_utils.update_issue_body(issue_num, updated_body)

    agent_log(
        f"Issue #{issue_num}: "
        f"{'blocked by ' + ', '.join('#' + str(d['issue_number']) for d in dependencies) if dependencies else 'no blocking dependencies'}"
    )
    return True


def main() -> None:
    raw_issue_number = sys.argv[1].strip() if len(sys.argv) > 1 else ""
    target_issue_number = int(raw_issue_number) if raw_issue_number else None

    all_open_issues = github_utils.list_issues(state="open")
    issues = all_open_issues
    if target_issue_number is not None:
        issues = [issue for issue in issues if issue["number"] == target_issue_number]
    issues = github_utils.filter_project_todo_issues(issues)

    eligible_issues = []
    for issue in issues:
        labels = labels_for(issue)
        if "epic" in labels:
            continue
        if github_utils.dependency_assessment_exists(issue):
            continue
        eligible_issues.append(issue)

    if not eligible_issues:
        if target_issue_number is None:
            agent_log("No eligible issues found for Dependency Tracker.")
        else:
            agent_log(f"Issue #{target_issue_number} is not eligible for Dependency Tracker.")
        return

    agent_log(
        f"Found {len(eligible_issues)} eligible issue(s); processing one fresh session per run."
    )
    issue = pick_primary_issue(eligible_issues)
    if issue:
        process_issue(issue, all_open_issues)


if __name__ == "__main__":
    main()
