#!/usr/bin/env python3
import argparse
import json
import os
import sys

# Add path so we can import github_utils
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import github_utils


def prompt_input(prompt_text, default=""):
    try:
        val = input(f"{prompt_text} [{default}]: ").strip()
        return val if val else default
    except (KeyboardInterrupt, EOFError):
        print("\nAborted.")
        sys.exit(0)


def prompt_multiline(prompt_text):
    print(f"{prompt_text} (Press Ctrl+D or type 'EOF' on a new line to finish):")
    lines = []
    while True:
        try:
            line = input()
            if line.strip() == "EOF":
                break
            lines.append(line)
        except EOFError:
            break
        except KeyboardInterrupt:
            print("\nAborted.")
            sys.exit(0)
    return "\n".join(lines).strip()


def ensure_epic_label():
    res = github_utils.run_cmd(["gh", "label", "list", "--json", "name"])
    if not res["success"]:
        print(f"Error fetching labels: {res['stderr']}")
        return False
    existing_names = {item["name"] for item in json.loads(res["stdout"])}
    if "epic" in existing_names:
        return True
    create_res = github_utils.run_cmd([
        "gh", "label", "create", "epic",
        "--color", "3E4B9E",
        "--description", "Large initiative tracking multiple related issues",
    ])
    if not create_res["success"]:
        print(f"Failed to create epic label: {create_res['stderr']}")
        return False
    return True


def format_bug_body(description, steps, expected, actual, env_os, env_browser, env_node, env_rev):
    return f"""## Description
{description}

## Steps to Reproduce
{steps}

## Expected Behavior
{expected}

## Actual Behavior
{actual}

## Environment Info
- OS: {env_os}
- Browser/Electron version: {env_browser}
- Node/pnpm version: {env_node}
- Code revision / Branch: {env_rev}
"""


def format_feature_body(goal, reqs, tech_notes, epic_issue=None):
    epic_section = ""
    if epic_issue:
        epic_section = f"\n## Epic\nTracks under #{epic_issue}\n"
    return f"""## Goal / Problem Description
{goal}

## Proposed Changes / Requirements
{reqs}

## Technical Notes / Context
{tech_notes}{epic_section}
"""


def format_epic_body(goal, background, tasks_raw, acceptance):
    # tasks_raw is a list of task description strings
    task_lines = "\n".join(f"- [ ] {t.strip()}" for t in tasks_raw if t.strip())
    return f"""## Goal
{goal}

## Background / Context
{background}

## Tasks
{task_lines}

## Acceptance Criteria
{acceptance}
"""


def normalize_title(title, issue_type):
    if issue_type == "bug":
        if not title.upper().startswith("[BUG]"):
            return f"[BUG] {title}"
        return title
    if issue_type == "epic":
        if not title.upper().startswith("[EPIC]"):
            return f"[EPIC] {title}"
        return title
    type_prefix = issue_type.upper()
    prefixes = ("[FEATURE", "[TASK", "[REFACTOR", "[CHORE]")
    if not title.upper().startswith(prefixes):
        return f"[{type_prefix}] {title}"
    return title


def create_structured_issue(title, body, labels=None):
    issue_num = github_utils.create_github_issue(title, body, labels=labels)
    if issue_num:
        print(f"Successfully created issue #{issue_num}: {title}")
    else:
        print(f"Failed to create issue: {title}")
    return issue_num


def create_batch_issues(batch_path, dry_run=False):
    with open(batch_path, encoding="utf-8") as handle:
        payload = json.load(handle)

    issues = payload.get("issues", payload if isinstance(payload, list) else [])
    if not issues:
        print("No issues found in batch file.")
        return 1

    if not dry_run:
        ensure_epic_label()
        github_utils.ensure_labels_exist()

    created = {}
    for entry in issues:
        key = entry.get("key")
        issue_type = entry.get("type", "feature")
        title = normalize_title(entry["title"], issue_type)
        epic_key = entry.get("epic_key")
        epic_issue = entry.get("epic_issue") or (created.get(epic_key) if epic_key else None)
        body = format_feature_body(
            entry.get("goal", ""),
            entry.get("requirements", entry.get("reqs", "")),
            entry.get("tech_notes", ""),
            epic_issue=epic_issue,
        )
        labels = entry.get("labels", [])

        print(f"\n--- {'DRY RUN ' if dry_run else ''}Creating issue ---")
        print(f"Title: {title}")
        if labels:
            print(f"Labels: {', '.join(labels)}")
        if epic_issue:
            print(f"Epic: #{epic_issue}")

        if dry_run:
            if key:
                created[key] = f"dry-run-{key}"
            continue

        issue_num = create_structured_issue(title, body, labels=labels)
        if not issue_num:
            return 1
        if key:
            created[key] = issue_num

    print(f"\nCreated {len(created)} issue(s).")
    return 0


def main():
    parser = argparse.ArgumentParser(description="Create a structured GitHub issue using templates.")
    parser.add_argument("--type", choices=["bug", "feature", "task", "refactor", "chore", "epic"], help="Issue type")
    parser.add_argument("--title", help="Issue title")
    parser.add_argument("--goal", help="Goal / problem description")
    parser.add_argument("--requirements", help="Proposed changes / requirements")
    parser.add_argument("--tech-notes", help="Technical notes / context")
    parser.add_argument("--labels", help="Comma-separated GitHub labels")
    parser.add_argument("--yes", action="store_true", help="Create without confirmation prompt")
    parser.add_argument("--batch", help="JSON file with multiple issues to create")
    parser.add_argument("--dry-run", action="store_true", help="Print batch issues without creating them")
    args = parser.parse_args()

    if args.batch:
        return create_batch_issues(args.batch, dry_run=args.dry_run)

    issue_type = args.type
    if not issue_type:
        print("Select issue type:")
        print("1) Bug Report")
        print("2) Feature / Task / Refactor / Chore")
        print("3) Epic")
        choice = prompt_input("Choice (1-3)", "2")
        if choice == "1":
            issue_type = "bug"
        elif choice == "3":
            issue_type = "epic"
        else:
            issue_type = "feature"

    title = args.title or prompt_input("Enter issue title (short description)")
    title = normalize_title(title, issue_type)
    labels = [label.strip() for label in args.labels.split(",")] if args.labels else None

    if issue_type == "bug":
        description = args.goal or prompt_multiline("1. Description of the bug")
        steps = args.requirements or prompt_multiline("2. Steps to Reproduce")
        expected = args.tech_notes or prompt_multiline("3. Expected Behavior")
        actual = prompt_multiline("4. Actual Behavior")
        env_os = prompt_input("5a. OS", "Linux")
        env_browser = prompt_input("5b. Browser / Electron Version", "Chrome/Electron")
        env_node = prompt_input("5c. Node / pnpm Version", "Node 18+ / pnpm 10")
        env_rev = prompt_input("5d. Code revision / Branch", "main")
        body = format_bug_body(description, steps, expected, actual, env_os, env_browser, env_node, env_rev)
    elif issue_type == "epic":
        # Ensure epic label exists before creating
        ensure_epic_label()
        goal = args.goal or prompt_multiline("1. Goal — what is this epic working towards?")
        background = prompt_multiline("2. Background / Context")
        print("3. Tasks — enter each task on a new line (type 'EOF' or Ctrl+D to finish):")
        raw_tasks = []
        while True:
            try:
                line = input("  - ").strip()
                if line.upper() == "EOF" or not line:
                    break
                raw_tasks.append(line)
            except (EOFError, KeyboardInterrupt):
                break
        acceptance = prompt_multiline("4. Acceptance Criteria")
        body = format_epic_body(goal, background, raw_tasks, acceptance)
        # Always include epic label for epic issues
        labels = list(set((labels or []) + ["epic"]))
    else:
        goal = args.goal or prompt_multiline("1. Goal / Problem Description")
        reqs = args.requirements or prompt_multiline("2. Proposed Changes / Requirements")
        tech_notes = args.tech_notes or prompt_multiline("3. Technical Notes / Context")
        body = format_feature_body(goal, reqs, tech_notes)

    print("\n--- Generating Issue ---")
    print(f"Title: {title}")
    if labels:
        print(f"Labels: {', '.join(labels)}")
    print("Body:")
    print(body)
    print("------------------------")

    if args.yes or prompt_input("Create this issue on GitHub? (y/n)", "y").lower() == "y":
        issue_num = create_structured_issue(title, body, labels=labels)
        return 0 if issue_num else 1

    print("Cancelled.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
