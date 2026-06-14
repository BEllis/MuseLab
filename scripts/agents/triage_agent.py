import sys
import os
import re

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import github_utils

from dotenv import load_dotenv
load_dotenv()

import pydantic
from agent_config import model_for_agent
from openrouter_client import chat_structured

class TriageClassification(pydantic.BaseModel):
    conforms: bool
    missing_sections: list[str]
    priority: str
    readiness: str
    risk: str
    value: str
    explanation: str


def triage_issue(issue):
    issue_num = issue["number"]
    title = issue["title"]
    body = issue["body"] or ""
    current_labels = {label["name"] for label in issue.get("labels", [])}

    print(f"\n--- Triaging Issue #{issue_num}: {title} ---")

    is_epic = "epic" in current_labels or title.upper().startswith("[EPIC]")
    if is_epic:
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

        if body_changed:
            new_body = "\n".join(updated_lines)
            print(f"Updating body of Epic #{issue_num}...")
            github_utils.update_issue_body(issue_num, new_body)
            body = new_body

    prompt = f"""
Analyze the following GitHub issue and classify it.

Issue Title: {title}
Issue Body:
{body}

Triage criteria:
- CONFORMANCE:
  - Bug reports must contain headings '## Description', '## Steps to Reproduce', '## Expected Behavior', '## Actual Behavior', and '## Environment Info'.
  - Features/tasks/refactors/chores must contain '## Goal / Problem Description', '## Proposed Changes / Requirements', and '## Technical Notes / Context'.
- PRIORITY: high, medium, or low.
- READINESS: agent:ready, human:ready, agent:investigate, or human:investigate.
- RISK: high, medium, or low.
- VALUE: high, medium, or low.
"""

    triage_info = chat_structured(
        model=model_for_agent("triage"),
        system=(
            "You are an expert triage agent for GitHub issues. "
            "Return accurate labels and a short explanation."
        ),
        user=prompt,
        response_model=TriageClassification,
    )
    triage_data = triage_info.model_dump()
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

    state_relation = github_utils.get_issue_relations(issue_num)
    print(f"Codebase status relation for #{issue_num}: {state_relation}")

    target_labels = set(current_labels)
    if is_epic:
        target_labels.add("epic")

    has_priority = any(label.startswith("priority:") for label in target_labels)
    has_readiness = any(
        label in ["agent:ready", "human:ready", "agent:investigate", "human:investigate"]
        for label in target_labels
    )
    has_risk = any(label.startswith("risk:") for label in target_labels)
    has_val = any(label.startswith("value:") for label in target_labels)

    if not has_priority:
        target_labels.add(f"priority:{triage_data['priority']}")
    if not has_readiness:
        target_labels.add(triage_data["readiness"])
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
