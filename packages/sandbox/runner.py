#!/usr/bin/env python3
"""
OmniForge Sandbox Runner
Executes arbitrary Python/bash snippets in isolation with structured output.
Used by MCP tool servers and the orchestrator's HITL flow.

Contract:
  stdin JSON: {"language":"python|bash","code":"...","timeout_ms":15000}
  stdout JSON: {"exitCode":0,"stdout":"...","stderr":"...","timedOut":false}
"""
import json
import subprocess
import sys
import tempfile
import textwrap
import os


def _decoded(value) -> str:
    """TimeoutExpired output may be bytes (CPython) or str depending on version."""
    if isinstance(value, bytes):
        return value.decode(errors="replace")
    if isinstance(value, str):
        return value
    return ""


def run_python(code: str, timeout: float) -> dict:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(textwrap.dedent(code))
        fname = f.name
    try:
        proc = subprocess.run(
            [sys.executable, fname],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {"exitCode": proc.returncode, "stdout": proc.stdout, "stderr": proc.stderr, "timedOut": False}
    except subprocess.TimeoutExpired as e:
        return {"exitCode": 124, "stdout": _decoded(e.stdout), "stderr": "TimeoutExpired", "timedOut": True}
    finally:
        try:
            os.unlink(fname)
        except OSError:
            pass


def run_bash(code: str, timeout: float) -> dict:
    try:
        proc = subprocess.run(
            ["bash", "-c", code],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {"exitCode": proc.returncode, "stdout": proc.stdout, "stderr": proc.stderr, "timedOut": False}
    except subprocess.TimeoutExpired as e:
        return {"exitCode": 124, "stdout": _decoded(e.stdout), "stderr": "TimeoutExpired", "timedOut": True}


def main():
    raw = sys.stdin.read()
    if not raw.strip():
        print(json.dumps({"exitCode": 2, "stdout": "", "stderr": "empty stdin", "timedOut": False}))
        sys.exit(2)
    try:
        req = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"exitCode": 2, "stdout": "", "stderr": f"invalid json: {e}", "timedOut": False}))
        sys.exit(2)

    language = req.get("language", "python")
    code = req.get("code", "")
    timeout_ms = int(req.get("timeout_ms", 15000))
    timeout = timeout_ms / 1000.0

    if language == "bash":
        result = run_bash(code, timeout)
    else:
        result = run_python(code, timeout)

    print(json.dumps(result))


if __name__ == "__main__":
    main()
