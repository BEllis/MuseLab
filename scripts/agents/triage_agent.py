#!/usr/bin/env python3
"""Run MuseLab backlog triage (classify, assess, sync PR state, report)."""

import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

load_dotenv()

from backlog_manager import run_backlog_triage


def main() -> int:
    raw_issue_number = sys.argv[1].strip() if len(sys.argv) > 1 else ""
    issue_number = int(raw_issue_number) if raw_issue_number else None
    return run_backlog_triage(issue_number=issue_number)


if __name__ == "__main__":
    raise SystemExit(main())
