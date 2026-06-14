import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import github_utils

from dotenv import load_dotenv
load_dotenv()

from agent_config import agent_log, model_for_agent, timeout_for_agent
from agent_session import create_session_id, pick_primary_issue, with_fresh_session_instructions
from codebase_context import gather_codebase_context
from openrouter_client import chat_text


def process_issue(issue):
    issue_num = issue["number"]
    title = issue["title"]
    body = issue["body"] or ""

    agent_log(f"\n=======================================================")
    agent_log(f"Designer Agent picking up Issue #{issue_num}: {title}")
    agent_log(f"=======================================================")

    agent_log("Gathering repository context...")
    codebase_context = gather_codebase_context(title, body)
    agent_log(f"Repository context ready ({len(codebase_context)} chars).")

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

    model = model_for_agent("design")
    timeout_seconds = timeout_for_agent("design")
    agent_log(f"Requesting implementation plan from OpenRouter ({model})...")
    plan_content = chat_text(
        model=model,
        system=with_fresh_session_instructions(
            "You are an expert designer agent for the MuseLab monorepo. "
            "Produce concrete, file-specific plans without placeholders."
        ),
        user=prompt,
        temperature=0.2,
        session_id=create_session_id("design", issue_num),
        timeout_seconds=timeout_seconds,
    )

    if not plan_content or len(plan_content.strip()) < 50:
        agent_log(f"Failed to generate a valid plan for #{issue_num}.")
        return False

    agent_log(f"Generated Plan for #{issue_num}:\n{plan_content[:300]}...\n")

    comment_body = f"""<!-- designer-plan -->
{plan_content}
"""
    agent_log(f"Posting plan comment to issue #{issue_num}...")
    if github_utils.add_issue_comment(issue_num, comment_body):
        agent_log("Adding 'agent:planned' label...")
        github_utils.update_issue_labels(issue_num, add_labels=["agent:planned"])
        agent_log(f"Issue #{issue_num} planned successfully!")
        return True
    return False


def main():
    raw_issue_number = sys.argv[1].strip() if len(sys.argv) > 1 else ""
    target_issue_number = int(raw_issue_number) if raw_issue_number else None

    issues = github_utils.list_issues(state="open")
    if target_issue_number is not None:
        issues = [issue for issue in issues if issue["number"] == target_issue_number]

    eligible_issues = []
    for issue in issues:
        labels = {label["name"] for label in issue.get("labels", [])}
        if (
            "approved" in labels
            and "agent:ready" in labels
            and "agent:planned" not in labels
            and "epic" not in labels
            and "needs:human" not in labels
            and "agent:investigate" not in labels
        ):
            eligible_issues.append(issue)

    if not eligible_issues:
        if target_issue_number is None:
            agent_log(
                "No eligible issues found for Designer Agent "
                "(requires 'approved', 'agent:ready', and no 'agent:planned')."
            )
        else:
            agent_log(f"Issue #{target_issue_number} is not eligible for Designer Agent.")
        return

    agent_log(
        f"Found {len(eligible_issues)} eligible issue(s); processing one fresh session per run."
    )
    issue = pick_primary_issue(eligible_issues)
    if not issue:
        return

    agent_log(f"Processing one issue in a fresh session: #{issue['number']}")
    try:
        process_issue(issue)
    except Exception as exc:
        agent_log(f"Error processing issue #{issue['number']}: {exc}")
        raise


if __name__ == "__main__":
    main()
