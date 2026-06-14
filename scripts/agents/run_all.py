#!/usr/bin/env python3
import subprocess
import sys
import os

def run_script(script_name):
    script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), script_name)
    print(f"\n=======================================================")
    print(f"RUNNING AGENT: {script_name}")
    print(f"=======================================================")
    
    # Run the script using the current virtualenv's Python interpreter
    res = subprocess.run([sys.executable, script_path])
    if res.returncode != 0:
        print(f"\n[ERROR] Agent {script_name} failed with exit code {res.returncode}")
    else:
        print(f"\n[SUCCESS] Agent {script_name} completed.")

def main():
    print("Starting MuseLab Agent Backlog Loop...")
    
    # 1. Backlog manager: classify issues, post assessments, sync PR state
    run_script("triage_agent.py")

    # 2. Epic Manager: breaks epic-labelled issues into high-level child issues
    run_script("epic_manager_agent.py")

    # 3. Dependency Tracker: identifies blocking issue dependencies
    run_script("dependency_tracker_agent.py")
    
    # 4. Investigation Agent: Investigates agent:investigate tickets (reproduces bugs or researches options)
    run_script("investigation_agent.py")
    
    # 5. Designer Agent: Picks up project Todo agent:ready tickets and writes design implementation plans
    run_script("designer_agent.py")
    
    # 6. Implementation Agent: Picks up project Todo signed-off plans and opens a PR
    run_script("implementation_agent.py")
    
    print("\n=======================================================")
    print("MuseLab Agent Backlog Loop Completed.")
    print("=======================================================")

if __name__ == "__main__":
    main()
