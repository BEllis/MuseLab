import json
import os
import re
import subprocess
from typing import Any

from agent_config import resolve_repo_root

MAX_READ_CHARS = 100_000
MAX_WRITE_CHARS = 200_000
COMMAND_TIMEOUT_SECONDS = 600

BLOCKED_COMMAND_PATTERNS = (
    r"\bsudo\b",
    r"\bshutdown\b",
    r"\breboot\b",
    r"\bmkfs\b",
    r"\bdd\s+if=",
    r">\s*/dev/",
    r"\|\s*sh\b",
    r"\|\s*bash\b",
    r"curl\s+.*\|\s*(sh|bash)",
    r"wget\s+.*\|\s*(sh|bash)",
    r"rm\s+-rf\s+/",
)


def _repo_root() -> str:
    return resolve_repo_root()


def _resolve_repo_path(path: str) -> str:
    repo_root = _repo_root()
    if not path or path == ".":
        return repo_root
    candidate = os.path.abspath(os.path.join(repo_root, path))
    if not candidate.startswith(repo_root + os.sep) and candidate != repo_root:
        raise ValueError(f"Path escapes repository root: {path}")
    return candidate


def _validate_command(command: str) -> None:
    stripped = command.strip()
    if not stripped:
        raise ValueError("Command must not be empty.")
    for pattern in BLOCKED_COMMAND_PATTERNS:
        if re.search(pattern, stripped, flags=re.IGNORECASE):
            raise ValueError(f"Blocked command pattern matched: {pattern}")


def read_file(path: str) -> dict[str, Any]:
    abs_path = _resolve_repo_path(path)
    if not os.path.isfile(abs_path):
        raise FileNotFoundError(f"File not found: {path}")
    with open(abs_path, encoding="utf-8", errors="replace") as handle:
        content = handle.read(MAX_READ_CHARS)
    truncated = len(content) >= MAX_READ_CHARS
    if truncated:
        content += "\n...[truncated]..."
    return {"path": path, "content": content, "truncated": truncated}


def write_file(path: str, content: str) -> dict[str, Any]:
    if len(content) > MAX_WRITE_CHARS:
        raise ValueError(f"Refusing to write more than {MAX_WRITE_CHARS} characters.")
    abs_path = _resolve_repo_path(path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    with open(abs_path, "w", encoding="utf-8") as handle:
        handle.write(content)
    return {"path": path, "bytes_written": len(content.encode("utf-8"))}


def list_directory(path: str = ".") -> dict[str, Any]:
    abs_path = _resolve_repo_path(path)
    if not os.path.isdir(abs_path):
        raise NotADirectoryError(f"Directory not found: {path}")
    entries = sorted(os.listdir(abs_path))[:200]
    return {"path": path or ".", "entries": entries}


def search_code(pattern: str, path: str = ".") -> dict[str, Any]:
    abs_path = _resolve_repo_path(path)
    cmd = [
        "rg",
        "-n",
        "--max-count", "20",
        "--glob", "!.git/**",
        "--glob", "!node_modules/**",
        "--glob", "!dist/**",
        pattern,
        abs_path if os.path.isdir(abs_path) else os.path.dirname(abs_path) or ".",
    ]
    result = subprocess.run(
        cmd,
        cwd=_repo_root(),
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    return {
        "pattern": pattern,
        "path": path,
        "exit_code": result.returncode,
        "matches": result.stdout.strip(),
        "stderr": result.stderr.strip(),
    }


def run_command(command: str) -> dict[str, Any]:
    _validate_command(command)
    result = subprocess.run(
        command,
        cwd=_repo_root(),
        shell=True,
        capture_output=True,
        text=True,
        timeout=COMMAND_TIMEOUT_SECONDS,
        check=False,
    )
    return {
        "command": command,
        "exit_code": result.returncode,
        "stdout": result.stdout[-20_000:],
        "stderr": result.stderr[-20_000:],
    }


IMPLEMENTATION_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a UTF-8 text file relative to the repository root.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative file path"},
                },
                "required": ["path"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Create or overwrite a UTF-8 text file relative to the repository root.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "content": {"type": "string"},
                },
                "required": ["path", "content"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_directory",
            "description": "List entries in a directory relative to the repository root.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative directory path"},
                },
                "required": ["path"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_code",
            "description": "Search the repository with ripgrep for a regex pattern.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string"},
                    "path": {"type": "string", "description": "Relative path to search within"},
                },
                "required": ["pattern"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": (
                "Run a shell command in the repository root. Use for git, pnpm, gh, and tests."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string"},
                },
                "required": ["command"],
                "additionalProperties": False,
            },
        },
    },
]


def execute_tool(name: str, args: dict[str, Any]) -> dict[str, Any]:
    if name == "read_file":
        return read_file(args["path"])
    if name == "write_file":
        return write_file(args["path"], args["content"])
    if name == "list_directory":
        return list_directory(args.get("path", "."))
    if name == "search_code":
        return search_code(args["pattern"], args.get("path", "."))
    if name == "run_command":
        return run_command(args["command"])
    raise ValueError(f"Unknown tool: {name}")
