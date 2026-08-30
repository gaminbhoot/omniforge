import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sandboxExec } from "@omniforge/mcp-tools/shared/sandboxExec";

// These tests exercise the local exec path directly (no Docker dependency):
// SANDBOX_DOCKER=false skips Docker; SANDBOX_ALLOW_LOCAL=true is the explicit
// dev opt-in that sandboxExec requires (SA-03 fail-closed).
const PREV = { docker: process.env.SANDBOX_DOCKER, local: process.env.SANDBOX_ALLOW_LOCAL };

beforeAll(() => {
  process.env.SANDBOX_DOCKER = "false";
  process.env.SANDBOX_ALLOW_LOCAL = "true";
});

afterAll(() => {
  if (PREV.docker === undefined) delete process.env.SANDBOX_DOCKER; else process.env.SANDBOX_DOCKER = PREV.docker;
  if (PREV.local === undefined) delete process.env.SANDBOX_ALLOW_LOCAL; else process.env.SANDBOX_ALLOW_LOCAL = PREV.local;
});

describe("sandboxExec contract", () => {
  it("executes python and returns a structured result", async () => {
    const r = await sandboxExec({ language: "python", code: "print('contract-ok')" });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("contract-ok");
    expect(r.timedOut).toBe(false);
  });

  it("captures non-zero exit codes and stderr", async () => {
    const r = await sandboxExec({ language: "python", code: "import sys; print('boom', file=sys.stderr); sys.exit(3)" });
    expect(r.exitCode).toBe(3);
    expect(r.stderr).toContain("boom");
  });

  it("rejects code payloads over the 64KB cap without executing them (SA-08)", async () => {
    await expect(
      sandboxExec({ language: "python", code: "x = '" + "1".repeat(70_000) + "'" })
    ).rejects.toThrow(/64,000-byte cap|64,000-byte|byte cap/);
  });

  it("clamps oversized client timeouts instead of honoring them (SA-08)", async () => {
    const t0 = Date.now();
    const r = await sandboxExec({ language: "python", code: "import time; time.sleep(120)", timeout_ms: 600_000 });
    const wall = Date.now() - t0;
    expect(r.timedOut).toBe(true);
    expect(wall).toBeLessThan(35_000); // clamped to the 30s ceiling (runs ~1.5s locally via min clamp races)
  }, 60_000);

  it("fails closed when the local fallback is not explicitly opted in (SA-03)", async () => {
    delete process.env.SANDBOX_ALLOW_LOCAL;
    try {
      await expect(
        sandboxExec({ language: "python", code: "print('must-not-run')" })
      ).rejects.toThrow(/SANDBOX_ALLOW_LOCAL|sandbox Docker/);
    } finally {
      process.env.SANDBOX_ALLOW_LOCAL = "true";
    }
  });
});
