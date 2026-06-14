import subprocess
import json
import re
import os

PROJECT_OWNER = os.environ.get("MUSELAB_PROJECT_OWNER", "BEllis")
PROJECT_NUMBER = int(os.environ.get("MUSELAB_PROJECT_NUMBER", "1"))
PROJECT_STATUS_FIELD = os.environ.get("MUSELAB_PROJECT_STATUS_FIELD", "Status")
PROJECT_TODO_STATUS = os.environ.get("MUSELAB_PROJECT_TODO_STATUS", "Todo")
PROJECT_IN_PROGRESS_STATUS = os.environ.get(
    "MUSELAB_PROJECT_IN_PROGRESS_STATUS", "In Progress"
)
PROJECT_DONE_STATUS = os.environ.get("MUSELAB_PROJECT_DONE_STATUS", "Done")

def run_cmd(args, cwd=None):
    """Helper to run a shell command and return output, stdout, stderr, and exit code."""
    res = subprocess.run(args, capture_output=True, text=True, cwd=cwd)
    return {
        "success": res.returncode == 0,
        "stdout": res.stdout.strip(),
        "stderr": res.stderr.strip(),
        "exit_code": res.returncode
    }

def _project_env():
    env = os.environ.copy()
    project_token = (
        os.environ.get("GH_PROJECT_TOKEN")
        or os.environ.get("PROJECT_TOKEN")
        or os.environ.get("GITHUB_PROJECT_TOKEN")
    )
    if project_token:
        env["GH_TOKEN"] = project_token
    return env

def run_project_cmd(args):
    """Runs a gh command with a project-capable token when configured."""
    res = subprocess.run(args, capture_output=True, text=True, env=_project_env())
    return {
        "success": res.returncode == 0,
        "stdout": res.stdout.strip(),
        "stderr": res.stderr.strip(),
        "exit_code": res.returncode
    }

def _run_project_graphql(query, variables=None):
    cmd = ["gh", "api", "graphql", "-f", f"query={query}"]
    for key, value in (variables or {}).items():
        flag = "-F" if isinstance(value, int) else "-f"
        cmd.extend([flag, f"{key}={value}"])
    res = run_project_cmd(cmd)
    if not res["success"]:
        print(f"Project query failed: {res['stderr']}")
        return None
    return json.loads(res["stdout"])

def _load_project_snapshot():
    query = """
query($owner: String!, $number: Int!, $after: String) {
  user(login: $owner) {
    projectV2(number: $number) {
      id
      fields(first: 50) {
        nodes {
          ... on ProjectV2FieldCommon {
            id
            name
            dataType
          }
          ... on ProjectV2SingleSelectField {
            id
            name
            dataType
            options {
              id
              name
            }
          }
        }
      }
      items(first: 100, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          content {
            ... on Issue {
              number
            }
          }
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2SingleSelectField {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
"""
    items = []
    project = None
    after = ""
    while True:
        variables = {"owner": PROJECT_OWNER, "number": PROJECT_NUMBER}
        if after:
            variables["after"] = after
        data = _run_project_graphql(query, variables)
        if not data:
            return None
        project = data.get("data", {}).get("user", {}).get("projectV2")
        if not project:
            print(f"Project {PROJECT_OWNER}/{PROJECT_NUMBER} was not found.")
            return None
        items_page = project["items"]
        items.extend(items_page.get("nodes") or [])
        page_info = items_page.get("pageInfo") or {}
        if not page_info.get("hasNextPage"):
            break
        after = page_info.get("endCursor") or ""
        if not after:
            break

    project = dict(project)
    project["items"] = {"nodes": items}
    return project

def _project_status_field(project):
    for field in project.get("fields", {}).get("nodes", []) or []:
        if field and field.get("name") == PROJECT_STATUS_FIELD:
            return field
    return None

def _item_status(item):
    for value in item.get("fieldValues", {}).get("nodes", []) or []:
        if not value:
            continue
        field = value.get("field") or {}
        if field.get("name") == PROJECT_STATUS_FIELD:
            return value.get("name")
    return None

def _project_issue_items(project):
    rows = []
    for item in project.get("items", {}).get("nodes", []) or []:
        content = item.get("content") or {}
        number = content.get("number")
        if number is None:
            continue
        rows.append({
            "number": int(number),
            "item_id": item.get("id"),
            "status": _item_status(item),
        })
    return rows

def get_project_todo_issue_numbers():
    """Returns issue numbers in project order for items currently in Todo."""
    project = _load_project_snapshot()
    if not project:
        return []
    return [
        row["number"]
        for row in _project_issue_items(project)
        if row["status"] == PROJECT_TODO_STATUS
    ]

def filter_project_todo_issues(issues):
    """Filters issues to the project's Todo column and preserves project order."""
    todo_numbers = get_project_todo_issue_numbers()
    if not todo_numbers:
        return []
    by_number = {issue["number"]: issue for issue in issues}
    return [by_number[number] for number in todo_numbers if number in by_number]

def update_project_issue_status(issue_number, status_name):
    """Updates a Project v2 issue item's Status field when it is in the configured project."""
    project = _load_project_snapshot()
    if not project:
        return False

    status_field = _project_status_field(project)
    if not status_field:
        print(f"Project status field '{PROJECT_STATUS_FIELD}' was not found.")
        return False

    option_id = None
    for option in status_field.get("options") or []:
        if option.get("name") == status_name:
            option_id = option.get("id")
            break
    if not option_id:
        print(f"Project status option '{status_name}' was not found.")
        return False

    target_item = None
    for row in _project_issue_items(project):
        if row["number"] == issue_number:
            target_item = row
            break
    if not target_item:
        return False
    if target_item["status"] == status_name:
        return False

    mutation = """
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId
    itemId: $itemId
    fieldId: $fieldId
    value: { singleSelectOptionId: $optionId }
  }) {
    projectV2Item {
      id
    }
  }
}
"""
    data = _run_project_graphql(
        mutation,
        {
            "projectId": project["id"],
            "itemId": target_item["item_id"],
            "fieldId": status_field["id"],
            "optionId": option_id,
        },
    )
    if not data:
        return False
    print(f"Updated project status for issue #{issue_number} to {status_name}.")
    return True

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
        "epic:planned": {"color": "bfdadc", "description": "Epic has been broken into high-level child issues"},
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

def get_issue_node_id(issue_number):
    """Returns the GraphQL node ID for an issue."""
    res = run_cmd(["gh", "issue", "view", str(issue_number), "--json", "id"])
    if not res["success"]:
        print(f"Error fetching node ID for issue #{issue_number}: {res['stderr']}")
        return None
    try:
        return json.loads(res["stdout"]).get("id")
    except json.JSONDecodeError:
        return None

def get_repo_name_with_owner():
    res = run_cmd(["gh", "repo", "view", "--json", "nameWithOwner"])
    if not res["success"]:
        print(f"Error fetching repository name: {res['stderr']}")
        return None
    try:
        return json.loads(res["stdout"]).get("nameWithOwner")
    except json.JSONDecodeError:
        return None

def list_sub_issue_numbers(parent_issue_number):
    repo = get_repo_name_with_owner()
    if not repo:
        return None
    res = run_cmd([
        "gh", "api",
        f"repos/{repo}/issues/{parent_issue_number}/sub_issues",
        "--paginate",
        "--jq", ".[].number",
    ])
    if not res["success"]:
        return None
    numbers = set()
    for line in res["stdout"].splitlines():
        try:
            numbers.add(int(line.strip()))
        except ValueError:
            continue
    return numbers

def add_sub_issue(parent_issue_number, sub_issue_number):
    """Links an existing issue as a GitHub sub-issue of another issue."""
    existing_sub_issues = list_sub_issue_numbers(parent_issue_number)
    if existing_sub_issues is not None and int(sub_issue_number) in existing_sub_issues:
        return True

    parent_id = get_issue_node_id(parent_issue_number)
    sub_issue_id = get_issue_node_id(sub_issue_number)
    if not parent_id or not sub_issue_id:
        return False

    mutation = """
mutation($parentId: ID!, $subIssueId: ID!) {
  addSubIssue(input: {
    issueId: $parentId
    subIssueId: $subIssueId
  }) {
    issue {
      id
    }
    subIssue {
      id
    }
  }
}
"""
    res = run_cmd([
        "gh", "api", "graphql",
        "-f", f"query={mutation}",
        "-f", f"parentId={parent_id}",
        "-f", f"subIssueId={sub_issue_id}",
    ])
    if not res["success"]:
        print(
            f"Error linking issue #{sub_issue_number} as sub-issue of "
            f"#{parent_issue_number}: {res['stderr']}"
        )
        return False
    print(f"Linked issue #{sub_issue_number} as a sub-issue of #{parent_issue_number}.")
    return True

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

