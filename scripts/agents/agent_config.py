import os

AGENT_DIR = os.path.dirname(os.path.abspath(__file__))

DEFAULT_MODELS = {
    "triage": "google/gemini-2.5-flash",
    "investigate": "anthropic/claude-sonnet-4",
    "design": "anthropic/claude-sonnet-4",
    "implement": "anthropic/claude-sonnet-4",
}


def resolve_repo_root() -> str:
    workspace = os.environ.get("GITHUB_WORKSPACE")
    if workspace:
        return os.path.abspath(workspace)
    override = os.environ.get("MUSELAB_REPO_ROOT")
    if override:
        return os.path.abspath(override)
    return os.path.abspath(os.path.join(AGENT_DIR, "..", ".."))


def model_for_agent(agent_name: str) -> str:
    env_key = f"OPENROUTER_MODEL_{agent_name.upper()}"
    return os.environ.get(env_key, DEFAULT_MODELS[agent_name])
