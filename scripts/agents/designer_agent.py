import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import github_utils

from dotenv import load_dotenv
load_dotenv()

from agent_config import model_for_agent
from agent_session import create_session_id, pick_primary_issue, with_fresh_session_instructions
from codebase_context import gather_codebase_context
from openrouter_client import chat_text


def process_issue(issue):
    issue_num = issue["number"]
    title = issue["title"]
    body = issue["body"] or ""

    print(f"\n=======================================================")
    print(f"Designer Agent picking up Issue #{issue_num}: {title}")
    print(f"=======================================================")

    codebase_context = gather_codebase_context(title, body)

    prompt = f"""
Write a detailed implementation plan for this issue using the repository context below.

Issue #{issue_num}: {title}

Issue Description:
{body}

Repository Context:
{codebase_context}

Your output must be markdown with this structure:
# Technical Implementation Plan: [Issue Title]

## Overview
Brief summary of the proposed solution and architecture.

## Proposed Code Changes
Specific files to modify or create, with exact paths and function/class details.

## Verification Plan
Build, test, and manual verification steps.
"""

    plan_content = chat_text(
        model=model_for_agent("design"),
        system=with_fresh_session_instructions(
            "You are an expert designer agent for the MuseLab monorepo. "
            "Produce concrete, file-specific plans without placeholders."
        ),
        user=prompt,
        temperature=0.2,
        session_id=create_session_id("design", issue_num),
    )

    if not plan_content or len(plan_content.strip()) < 50:
        print(f"Failed to generate a valid plan for #{issue_num}.")
        return False

    print(f"Generated Plan for #{issue_num}:\n{plan_content[:300]}...\n")

    comment_body = f"""<!-- designer-plan -->
{plan_content}
"""
    print(f"Posting plan comment to issue #{issue_num}...")
    if github_utils.add_issue_comment(issue_num, comment_body):
        print("Adding 'agent:planned' label...")
        github_utils.update_issue_labels(issue_num, add_labels=["agent:planned"])
        print(f"Issue #{issue_num} planned successfully!")
        return True
    return False


def main():
    issues = github_utils.list_issues(state="open")

    eligible_issues = []
    for issue in issues:
        labels = {label["name"] for label in issue.get("labels", [])}
        if "agent:ready" in labels and "agent:planned" not in labels and "epic" not in labels:
            eligible_issues.append(issue)

    if not eligible_issues:
        print(
            "No eligible issues found for Designer Agent "
            "(requires 'agent:ready' and no 'agent:planned')."
        )
        return

    print(f"Found {len(eligible_issues)} eligible issue(s); processing one fresh session per run.")
    issue = pick_primary_issue(eligible_issues)
    if not issue:
        return

    print(f"Processing one issue in a fresh session: #{issue['number']}")
    try:
        process_issue(issue)
    except Exception as exc:
        print(f"Error processing issue #{issue['number']}: {exc}")


if __name__ == "__main__":
    main()
