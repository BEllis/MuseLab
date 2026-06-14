import subprocess
import json
import re
import os

def run_cmd(args, cwd=None):
    """Helper to run a shell command and return output, stdout, stderr, and exit code."""
    res = subprocess.run(args, capture_output=True, text=True, cwd=cwd)
    return {
        "success": res.returncode == 0,
        "stdout": res.stdout.strip(),
        "stderr": res.stderr.strip(),
        "exit_code": res.returncode
    }

def ensure_labels_exist():
    """Fetches existing labels and creates any missing backlog or workflow labels."""
    expected_labels = {
        # Risk (backlog-manager)
        "risk:low": {"color": "0e8a16", "description": "Low-risk issue suitable for agent execution when agent-ready"},
        "risk:medium": {"color": "fbca04", "description": "Medium risk; do not execute unattended by default"},
        "risk:high": {"color": "b60205", "description": "High risk; human-led or investigate/plan only"},
        # Type (backlog-manager)
        "type:bug": {"color": "5319e7", "description": "Incorrect behavior or regression"},
        "type:feature": {"color": "5319e7", "description": "New user-facing or developer-facing capability"},
        "type:docs": {"color": "5319e7", "description": "Documentation or written guidance"},
        "type:test": {"color": "5319e7", "description": "Tests, coverage, or test reliability"},
        "type:refactor": {"color": "5319e7", "description": "Internal restructuring without intended behavior change"},
        "type:chore": {"color": "5319e7", "description": "Maintenance such as CI, deps, or repo cleanup"},
        # Routing (backlog-manager + MuseLab pipeline)
        "agent:ready": {"color": "1d76db", "description": "Safe for agent execution when risk is low"},
        "needs:human": {"color": "d93f0b", "description": "Human decision or clarification required"},
        "agent:investigate": {"color": "5319e7", "description": "Needs investigation by an agent"},
        "human:ready": {"color": "1d76db", "description": "Ready for human implementation (legacy)"},
        "human:investigate": {"color": "e99695", "description": "Needs feedback from human (legacy)"},
        # Legacy priority/value labels (not set by backlog manager)
        "priority:high": {"color": "d73a4a", "description": "High priority task"},
        "priority:medium": {"color": "f8a978", "description": "Medium priority task"},
        "priority:low": {"color": "fef2c0", "description": "Low priority task"},
        "value:high": {"color": "1d76db", "description": "High value for the product offering"},
        "value:medium": {"color": "006b75", "description": "Medium value for the product offering"},
        "value:low": {"color": "cfd3d7", "description": "Low value for the product offering"},
        # Workflow/Planning
        "agent:planned": {"color": "bfdadc", "description": "Design plan has been written by agent"},
        "plan:signoff": {"color": "2cbe4e", "description": "Human has reviewed and signed off on the plan"},
        # Status
        "status:in-progress": {"color": "fbca04", "description": "Work is actively in progress (branch exists)"},
        "status:in-review": {"color": "1d76db", "description": "Work is in review (PR exists)"},
        # Epics
        "epic": {"color": "3e4b9e", "description": "Large initiative tracking multiple related issues"},
    }

    res = run_cmd(["gh", "label", "list", "--json", "name"])
    if not res["success"]:
        print(f"Error fetching labels: {res['stderr']}")
        return False

    existing_names = {item["name"] for item in json.loads(res["stdout"])}
    
    for name, info in expected_labels.items():
        if name not in existing_names:
            print(f"Creating label: {name}")
            create_res = run_cmd([
                "gh", "label", "create", name,
                "--color", info["color"],
                "--description", info["description"]
            ])
            if not create_res["success"]:
                print(f"Failed to create label {name}: {create_res['stderr']}")
        else:
            print(f"Label already exists: {name}")
    return True

def list_issues(state="open"):
    """Lists issues in the repository, returning them as a list of dicts."""
    res = run_cmd([
        "gh", "issue", "list",
        "--state", state,
        "--limit", "100",
        "--json", "number,title,body,labels,comments"
    ])
    if not res["success"]:
        print(f"Error listing issues: {res['stderr']}")
        return []
    return json.loads(res["stdout"])

def get_issue_details(issue_number):
    """Retrieves full details of a specific issue, including comments."""
    res = run_cmd([
        "gh", "issue", "view", str(issue_number),
        "--json", "number,title,body,labels,comments"
    ])
    if not res["success"]:
        print(f"Error viewing issue #{issue_number}: {res['stderr']}")
        return None
    return json.loads(res["stdout"])

def add_issue_comment(issue_number, body):
    """Adds a comment to an issue."""
    res = run_cmd([
        "gh", "issue", "comment", str(issue_number),
        "--body", body
    ])
    if not res["success"]:
        print(f"Error commenting on issue #{issue_number}: {res['stderr']}")
        return False
    return True

def edit_issue_comment(comment_id, body):
    """Updates an existing issue comment."""
    res = run_cmd([
        "gh", "api",
        f"repos/{{owner}}/{{repo}}/issues/comments/{comment_id}",
        "-X", "PATCH",
        "-f", f"body={body}",
    ])
    if not res["success"]:
        print(f"Error editing comment {comment_id}: {res['stderr']}")
        return False
    return True

def set_issue_labels(issue_number, labels):
    """Replaces or updates labels on an issue. 
    Unfortunately gh issue edit takes --add-label and --remove-label.
    To set labels explicitly, we find current labels and remove ones not in the new list,
    and add the ones that are new.
    """
    details = get_issue_details(issue_number)
    if not details:
        return False
    
    current_labels = {l["name"] for l in details.get("labels", [])}
    target_labels = set(labels)
    
    to_add = list(target_labels - current_labels)
    to_remove = list(current_labels - target_labels)
    
    return update_issue_labels(issue_number, to_add, to_remove)

def update_issue_labels(issue_number, add_labels=None, remove_labels=None):
    """Adds and/or removes labels from an issue."""
    cmd = ["gh", "issue", "edit", str(issue_number)]
    if add_labels:
        cmd.extend(["--add-label", ",".join(add_labels)])
    if remove_labels:
        cmd.extend(["--remove-label", ",".join(remove_labels)])
        
    if not add_labels and not remove_labels:
        return True
        
    res = run_cmd(cmd)
    if not res["success"]:
        print(f"Error updating labels for issue #{issue_number}: {res['stderr']}")
        return False
    return True

def create_github_issue(title, body, labels=None):
    """Creates a new issue on GitHub."""
    cmd = ["gh", "issue", "create", "--title", title, "--body", body]
    if labels:
        cmd.extend(["--label", ",".join(labels)])
    res = run_cmd(cmd)
    if not res["success"]:
        print(f"Error creating issue: {res['stderr']}")
        return None
    # Extract issue number or URL from stdout (usually stdout is the issue URL)
    url = res["stdout"].strip()
    match = re.search(r'/issues/(\d+)', url)
    if match:
        return int(match.group(1))
    return url

def get_codebase_status():
    """Scans local/remote git branches and open/closed PRs to match with issues."""
    # 1. Get branches
    branches_res = run_cmd(["git", "branch", "-a"])
    branches = []
    if branches_res["success"]:
        for line in branches_res["stdout"].splitlines():
            line = line.replace("*", "").strip()
            # Clean up remote refs/heads/ prefix
            if "remotes/origin/" in line:
                line = line.replace("remotes/origin/", "")
            if line and line not in branches:
                branches.append(line)
                
    # 2. Get PRs
    # Fetch both open and merged PRs to verify state
    prs_res = run_cmd([
        "gh", "pr", "list",
        "--state", "all",
        "--limit", "100",
        "--json", "number,title,body,headRefName,state,isMerged,url"
    ])
    prs = []
    if prs_res["success"]:
        prs = json.loads(prs_res["stdout"])
        
    return {
        "branches": branches,
        "prs": prs
    }

def get_issue_relations(issue_number, status_info=None):
    """Checks if there's an active branch, open PR, or merged PR for a given issue number."""
    if not status_info:
        status_info = get_codebase_status()
        
    branches = status_info["branches"]
    prs = status_info["prs"]
    
    # Check branch matches: issue-<num>, issue/<num>, feature/<num>, <num>-something, etc.
    issue_pattern = re.compile(rf'(^|[^0-9]){issue_number}([^0-9]|$)')
    
    has_branch = False
    for branch in branches:
        # Check if the branch name contains the issue number as a word/separated token
        if issue_pattern.search(branch) or f"issue-{issue_number}" in branch or f"issue/{issue_number}" in branch:
            has_branch = True
            break
            
    # Check PR matches
    has_open_pr = False
    has_merged_pr = False
    
    for pr in prs:
        # Check if the head branch matches
        head_branch = pr.get("headRefName", "")
        branch_match = (issue_pattern.search(head_branch) or 
                        f"issue-{issue_number}" in head_branch or 
                        f"issue/{issue_number}" in head_branch)
        
        # Check if description/body mentions it (e.g. Closes #123, Fixes #123, or just #123)
        body_match = False
        body = pr.get("body", "") or ""
        if re.search(rf'#\s*{issue_number}\b', body, re.IGNORECASE):
            body_match = True
            
        # Check if title mentions it
        title_match = False
        title = pr.get("title", "") or ""
        if re.search(rf'#\s*{issue_number}\b', title) or f"issue-{issue_number}" in title:
            title_match = True
            
        if branch_match or body_match or title_match:
            is_merged = pr.get("isMerged", False)
            state = pr.get("state", "").upper()
            
            if is_merged or state == "MERGED":
                has_merged_pr = True
            elif state == "OPEN":
                has_open_pr = True
                
    if has_merged_pr:
        return "merged"
    elif has_open_pr:
        return "open_pr"
    elif has_branch:
        return "branch_exists"
    return "none"

def update_issue_body(issue_number, body):
    """Updates the body/description of a GitHub issue."""
    res = run_cmd([
        "gh", "issue", "edit", str(issue_number),
        "--body", body
    ])
    if not res["success"]:
        print(f"Error updating body for issue #{issue_number}: {res['stderr']}")
        return False
    return True

