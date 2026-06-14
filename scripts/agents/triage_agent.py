#!/usr/bin/env python3
"""Run MuseLab backlog triage (classify, assess, sync PR state, report)."""

import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

load_dotenv()

from backlog_manager import run_backlog_triage


def main() -> int:
    return run_backlog_triage()


if __name__ == "__main__":
    raise SystemExit(main())
