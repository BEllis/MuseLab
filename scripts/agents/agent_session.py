import uuid

FRESH_SESSION_INSTRUCTION = (
    "Treat this as a brand-new session. Do not rely on or refer to any prior "
    "agent conversation history. Base your answer only on the information provided below."
)


def create_session_id(agent_name: str, issue_number: int | None = None) -> str:
    scope = f"issue-{issue_number}" if issue_number is not None else "batch"
    return f"muselab:{agent_name}:{scope}:{uuid.uuid4()}"


def with_fresh_session_instructions(system: str) -> str:
    return f"{system}\n\n{FRESH_SESSION_INSTRUCTION}"


def pick_primary_issue(issues: list[dict]) -> dict | None:
    if not issues:
        return None
    return sorted(issues, key=lambda issue: issue["number"])[0]
