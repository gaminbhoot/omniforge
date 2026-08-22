FROM python:3.11-slim

LABEL org.opencontainers.image.title="omniforge-sandbox" \
      org.opencontainers.image.description="Isolated execution sandbox for OmniForge subagents" \
      org.opencontainers.image.source="https://github.com/gaminbhoot/omniforge"

# System deps: minimal diagnostic toolchain
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash curl jq git htop procps net-tools \
  && rm -rf /var/lib/apt/lists/*

# Non-root user (host UID 1000 compatible)
RUN useradd -m -u 1000 agent && mkdir -p /workspace && chown agent:agent /workspace
WORKDIR /workspace

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY runner.py /usr/local/bin/runner.py
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/runner.py

USER agent
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
