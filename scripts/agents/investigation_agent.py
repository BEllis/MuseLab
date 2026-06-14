import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import github_utils

from dotenv import load_dotenv
load_dotenv()

import pydantic
from agent_config import model_for_agent, timeout_for_agent
from agent_session import create_session_id, pick_primary_issue, with_fresh_session_instructions
from codebase_context import gather_codebase_context
from openrouter_client import chat_structured


class InvestigationResult(pydantic.BaseModel):
    needs_human_feedback: bool
    findings_or_questions: str
    updated_issue_description: str


def process_issue(issue):
    issue_num = issue["number"]
    title = issue["title"]
    body = issue["body"] or ""

    print(f"\n=======================================================")
    print(f"Investigation Agent picking up Issue #{issue_num}: {title}")
    print(f"=======================================================")

    is_bug = "[BUG]" in title.upper() or "bug" in [label["name"] for label in issue.get("labels", [])]

    details = github_utils.get_issue_details(issue_num)
    comments = details.get("comments", [])
    comments_str = ""
    for comment in comments:
        author = comment.get("author", {}).get("login", "unknown")
        comment_body = comment.get("body", "")
        comments_str += f"Comment by {author}:\n{comment_body}\n---\n"

    codebase_context = gather_codebase_context(title, body)

    prompt = f"""
Investigate the following issue using the repository context below.

Issue #{issue_num}: {title}
Issue Body:
{body}

Past Comments:
{comments_str}

Is Bug: {is_bug}

Repository Context:
{codebase_context}

Tasks:
- If it's a BUG: locate likely root cause, suggest reproduction steps, and draft an updated issue description with diagnosis.
- Otherwise: inspect the codebase context and recommend implementation options.
- If you need human feedback, set needs_human_feedback=true and ask specific questions.
- If investigation is complete, set needs_human_feedback=false and summarize findings.
- Put an updated bug description in updated_issue_description when applicable; otherwise return an empty string.
"""

    result = chat_structured(
        model=model_for_agent("investigate"),
        system=with_fresh_session_instructions(
            "You are an expert investigation agent for a TypeScript/React/Electron monorepo. "
            "Be concrete and reference files from the provided context when possible."
        ),
        user=prompt,
        response_model=InvestigationResult,
        session_id=create_session_id("investigate", issue_num),
        timeout_seconds=timeout_for_agent("investigate"),
    )
    result_data = result.model_dump()

    print(f"Investigation Result for #{issue_num}:")
    print(f"Needs human feedback: {result_data['needs_human_feedback']}")
    print(f"Findings/Questions (truncated): {result_data['findings_or_questions'][:200]}...")

    comment_header = (
        "<!-- investigation-feedback -->"
        if result_data["needs_human_feedback"]
        else "<!-- investigation-findings -->"
    )
    comment_body = f"""{comment_header}
{result_data['findings_or_questions']}
"""
    github_utils.add_issue_comment(issue_num, comment_body)

    if (
        is_bug
        and result_data["updated_issue_description"]
        and result_data["updated_issue_description"].strip()
    ):
        print(f"Updating description for issue #{issue_num}...")
        github_utils.run_cmd(
            ["gh", "issue", "edit", str(issue_num), "--body", result_data["updated_issue_description"]]
        )

    if result_data["needs_human_feedback"]:
        print("Changing label from agent:investigate to needs:human...")
        github_utils.update_issue_labels(
            issue_num,
            add_labels=["needs:human"],
            remove_labels=["agent:investigate"],
        )

    print(f"Completed investigation of #{issue_num}.")
    return True


def main():
    raw_issue_number = sys.argv[1].strip() if len(sys.argv) > 1 else ""
    target_issue_number = int(raw_issue_number) if raw_issue_number else None

    issues = github_utils.list_issues(state="open")
    if target_issue_number is not None:
        issues = [issue for issue in issues if issue["number"] == target_issue_number]
    issues = github_utils.filter_project_todo_issues(issues)

    status_info = github_utils.get_codebase_status()

    eligible_issues = []
    for issue in issues:
        labels = {label["name"] for label in issue.get("labels", [])}
        if "agent:investigate" in labels:
            state_relation = github_utils.get_issue_relations(issue["number"], status_info)
            if state_relation == "none" and not github_utils.has_unresolved_dependencies(issue):
                eligible_issues.append(issue)

    if not eligible_issues:
        if target_issue_number is None:
            print(
                "No eligible issues found for Investigation Agent "
                "(requires 'agent:investigate', no branch/PR, and no unresolved dependencies)."
            )
        else:
            print(f"Issue #{target_issue_number} is not eligible for Investigation Agent.")
        return

    print(f"Found {len(eligible_issues)} eligible issue(s); processing one fresh session per run.")
    issue = pick_primary_issue(eligible_issues)
    if not issue:
        return

    print(f"Processing one issue in a fresh session: #{issue['number']}")
    try:
        process_issue(issue)
    except Exception as exc:
        print(f"Error investigating issue #{issue['number']}: {exc}")


if __name__ == "__main__":
    main()
