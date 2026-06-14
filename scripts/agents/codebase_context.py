import os
import re
import subprocess

from agent_config import resolve_repo_root

MAX_CONTEXT_CHARS = 80_000
MAX_FILE_CHARS = 12_000
MAX_FILES = 12

IGNORE_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "tmp",
    "scaffolds/unity",
    "third_party/cito",
    "tools/cito",
}


def _should_skip_path(rel_path: str) -> bool:
    normalized = rel_path.replace("\\", "/")
    for ignored in IGNORE_DIRS:
        if normalized == ignored or normalized.startswith(f"{ignored}/"):
            return True
    return False


def _extract_terms(title: str, body: str, limit: int = 8) -> list[str]:
    text = f"{title}\n{body}"
    tokens = re.findall(r"[A-Za-z_][A-Za-z0-9_./-]{2,}", text)
    stopwords = {
        "the", "and", "for", "with", "from", "that", "this", "issue", "feature",
        "agent", "goal", "problem", "changes", "requirements", "technical", "notes",
        "context", "description", "proposed", "github", "muselab",
    }
    ranked: list[str] = []
    seen: set[str] = set()
    for token in tokens:
        lower = token.lower()
        if lower in stopwords or lower in seen:
            continue
        seen.add(lower)
        ranked.append(token)
        if len(ranked) >= limit:
            break
    return ranked


def _read_file(repo_root: str, rel_path: str) -> str | None:
    abs_path = os.path.join(repo_root, rel_path)
    if not os.path.isfile(abs_path):
        return None
    with open(abs_path, encoding="utf-8", errors="replace") as handle:
        content = handle.read(MAX_FILE_CHARS)
    if len(content) >= MAX_FILE_CHARS:
        content += "\n...[truncated]..."
    return content


def _rg_search(repo_root: str, pattern: str) -> list[str]:
    cmd = [
        "rg",
        "-l",
        "--fixed-strings",
        "--glob", "!.git/**",
        "--glob", "!node_modules/**",
        "--glob", "!dist/**",
        "--glob", "!tmp/**",
        pattern,
        ".",
    ]
    result = subprocess.run(
        cmd,
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode not in (0, 1):
        return []
    paths = []
    for line in result.stdout.splitlines():
        rel = line.strip().lstrip("./")
        if rel and not _should_skip_path(rel):
            paths.append(rel)
    return paths


def gather_codebase_context(title: str, body: str) -> str:
    repo_root = resolve_repo_root()
    sections: list[str] = [f"Repository root: {repo_root}"]

    for rel_path in ("README.md", "CONTRIBUTING.md", "docs/PROJECT_STATUS.md"):
        content = _read_file(repo_root, rel_path)
        if content:
            sections.append(f"## File: {rel_path}\n{content}")

    candidate_paths: list[str] = []
    for term in _extract_terms(title, body):
        candidate_paths.extend(_rg_search(repo_root, term))

    unique_paths: list[str] = []
    seen_paths: set[str] = set()
    for path in candidate_paths:
        if path in seen_paths:
            continue
        seen_paths.add(path)
        unique_paths.append(path)
        if len(unique_paths) >= MAX_FILES:
            break

    for rel_path in unique_paths:
        content = _read_file(repo_root, rel_path)
        if content:
            sections.append(f"## File: {rel_path}\n{content}")

    context = "\n\n".join(sections)
    if len(context) > MAX_CONTEXT_CHARS:
        context = context[:MAX_CONTEXT_CHARS] + "\n...[context truncated]..."
    return context
