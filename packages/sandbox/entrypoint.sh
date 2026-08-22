#!/usr/bin/env bash
set -euo pipefail
# Keep container alive for docker exec; runner.py handles per-task execution
exec "$@"
