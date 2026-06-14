import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import github_utils

from dotenv import load_dotenv
load_dotenv()

from agent_config import model_for_agent, resolve_repo_root, timeout_for_agent
from agent_session import create_session_id, pick_primary_issue, with_fresh_session_instructions
from agent_tools import IMPLEMENTATION_TOOLS, execute_tool
from codebase_context import gather_codebase_context
from openrouter_client import chat_with_tools


def process_issue(issue):
    issue_num = issue["number"]
    title = issue["title"]
    body = issue["body"] or ""

    print(f"\n=======================================================")
    print(f"Implementation Agent picking up Issue #{issue_num}: {title}")
    print(f"=======================================================")

    details = github_utils.get_issue_details(issue_num)
    comments = details.get("comments", [])
    comments_text = []
    for comment in comments:
        author = comment.get("author", {}).get("login", "unknown")
        comment_body = comment.get("body", "")
        comments_text.append(f"Comment by {author}:\n{comment_body}\n")
    comments_str = "\n---\n".join(comments_text)

    repo_root = resolve_repo_root()
    codebase_context = gather_codebase_context(title, body)

    prompt = f"""
Implement the approved plan for issue #{issue_num}.

Issue #{issue_num}: {title}

Issue Description:
{body}

Triage / Design Comments:
{comments_str}

Repository root: {repo_root}

Repository Context:
{codebase_context}

Required workflow:
1. Create and checkout branch issue-{issue_num}
2. Implement the plan with read_file, write_file, search_code, and list_directory
3. Run verification commands (for example pnpm test and targeted builds)
4. Commit all changes with message: Implement issue-{issue_num} plan
5. Push branch issue-{issue_num} to origin
6. Create a pull request with gh that closes #{issue_num}

Use run_command for git, pnpm, and gh operations. Stop only after the PR is created or you hit a blocker you cannot resolve.
"""

    final_output = chat_with_tools(
        model=model_for_agent("implement"),
        system=with_fresh_session_instructions(
            "You are an expert implementation agent for the MuseLab monorepo. "
            "Make minimal, correct changes, run verification, and open a PR."
        ),
        user=prompt,
        tools=IMPLEMENTATION_TOOLS,
        execute_tool=execute_tool,
        max_rounds=40,
        temperature=0.1,
        session_id=create_session_id("implement", issue_num),
        timeout_seconds=timeout_for_agent("implement"),
    )

    print(f"\nImplementation Agent completed for #{issue_num}. Output:\n{final_output}\n")
    return True


def main():
    raw_issue_number = sys.argv[1].strip() if len(sys.argv) > 1 else ""
    target_issue_number = int(raw_issue_number) if raw_issue_number else None

    issues = github_utils.list_issues(state="open")
    if target_issue_number is not None:
        issues = [issue for issue in issues if issue["number"] == target_issue_number]

    status_info = github_utils.get_codebase_status()

    eligible_issues = []
    for issue in issues:
        labels = {label["name"] for label in issue.get("labels", [])}
        if (
            "approved" in labels
            and "agent:ready" in labels
            and "plan:signoff" in labels
            and "epic" not in labels
        ):
            state_relation = github_utils.get_issue_relations(issue["number"], status_info)
            if state_relation == "none":
                eligible_issues.append(issue)

    if not eligible_issues:
        if target_issue_number is None:
            print(
                "No eligible issues found for Implementation Agent "
                "(requires 'approved', 'agent:ready', 'plan:signoff', and no branch/PR)."
            )
        else:
            print(f"Issue #{target_issue_number} is not eligible for Implementation Agent.")
        return

    print(f"Found {len(eligible_issues)} eligible issue(s); processing one fresh session per run.")
    issue = pick_primary_issue(eligible_issues)
    if not issue:
        return

    print(f"Processing one issue in a fresh session: #{issue['number']}")
    try:
        process_issue(issue)
    except Exception as exc:
        print(f"Error implementing issue #{issue['number']}: {exc}")


if __name__ == "__main__":
    main()
