import os

AGENT_DIR = os.path.dirname(os.path.abspath(__file__))

DEFAULT_MODELS = {
    "triage": "google/gemini-2.5-flash",
    "investigate": "anthropic/claude-sonnet-4",
    "design": "anthropic/claude-sonnet-4",
    "implement": "anthropic/claude-sonnet-4",
}

DEFAULT_TIMEOUTS = {
    "triage": 120.0,
    "investigate": 300.0,
    "design": 600.0,
    "implement": 900.0,
}


def agent_log(message: str) -> None:
    print(message, flush=True)


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


def timeout_for_agent(agent_name: str) -> float:
    env_key = f"OPENROUTER_TIMEOUT_{agent_name.upper()}"
    default = DEFAULT_TIMEOUTS.get(agent_name, 120.0)
    raw = os.environ.get(env_key, "").strip()
    if not raw:
        return default
    return float(raw)
