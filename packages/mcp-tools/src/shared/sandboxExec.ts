import { spawn } from "node:child_process";
import type { SandboxExecRequest, SandboxExecResult } from "./types.js";

/** Resource caps (SA-08): bounded payload, bounded runtime, bounded output. */
const CODE_MAX_BYTES = 64_000;
const TIMEOUT_MIN_MS = 1_000;
const TIMEOUT_MAX_MS = 30_000;
/** Cap applied to each result field (stdout/stderr) returned to callers. */
const OUTPUT_MAX_BYTES = 65_536;
/** Generous guard on the raw runner envelope so Node-side memory stays bounded; the JSON document itself must stay intact for parsing. */
const ENVELOPE_MAX_BYTES = 1_048_576;

function overCap(current: string, max: number): boolean {
  return Buffer.byteLength(current, "utf8") >= max;
}

function capField(v: string, max = OUTPUT_MAX_BYTES): string {
  return Buffer.byteLength(v, "utf8") > max ? `${v.slice(0, max)}\n…[truncated]` : v;
}

/**
 * Execute code inside the local sandbox container if available.
 *
 * Local (non-Docker) execution is an explicit dev-only opt-in: it requires
 * SANDBOX_ALLOW_LOCAL=true. Without it the check fails closed when the
 * sandbox container is unavailable (SA-03) — no silent host execution.
 */
export async function sandboxExec(req: SandboxExecRequest): Promise<SandboxExecResult> {
  if (Buffer.byteLength(req.code ?? "", "utf8") > CODE_MAX_BYTES) {
    throw new Error(`code exceeds the ${CODE_MAX_BYTES}-byte cap (SA-08)`);
  }
  const clamped: SandboxExecRequest = {
    ...req,
    timeout_ms: Math.min(TIMEOUT_MAX_MS, Math.max(TIMEOUT_MIN_MS, req.timeout_ms ?? 15_000)),
  };
  const allowLocal = process.env.SANDBOX_ALLOW_LOCAL === "true";
  const useDocker = process.env.SANDBOX_DOCKER !== "false" && process.env.SANDBOX_DOCKER !== "0";
  const isProd = process.env.NODE_ENV === "production" || process.env.SANDBOX_DOCKER === "true";
  if (useDocker) {
    try {
      return await dockerExec(clamped);
    } catch (e) {
      if (isProd || !allowLocal) {
        throw new Error(`sandbox Docker unavailable — start the sandbox container or set SANDBOX_ALLOW_LOCAL=true for local dev fallback (${String((e as Error).message ?? e)})`);
      }
      // dev fallback with warning
      console.warn("[sandboxExec] dockerExec failed, falling back to local (dev-only):", (e as Error).message);
    }
  } else if (isProd) {
    throw new Error("sandbox Docker required in production (SANDBOX_DOCKER=false is dev-only)");
  }
  if (!allowLocal) {
    throw new Error("local execution is disabled — set SANDBOX_ALLOW_LOCAL=true (dev-only) or start the sandbox container");
  }
  return localExec(clamped);
}

function dockerExec(req: SandboxExecRequest): Promise<SandboxExecResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn("docker", ["exec", "-i", "omniforge-sandbox", "python", "/usr/local/bin/runner.py"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    proc.stdout.on("data", (d) => { if (!overCap(out, ENVELOPE_MAX_BYTES)) out += d; });
    proc.stderr.on("data", (d) => { if (!overCap(err, ENVELOPE_MAX_BYTES)) err += d; });
    proc.on("error", (e) => done(() => reject(e)));
    proc.on("close", (code) => {
      done(() => {
        if (out) {
          try {
            const parsed = JSON.parse(out) as SandboxExecResult;
            // Cap the result fields — never the JSON envelope, which must parse intact
            resolve({ ...parsed, stdout: capField(parsed.stdout ?? ""), stderr: capField(parsed.stderr ?? "") });
            return;
          } catch {}
        }
        reject(new Error(`sandbox exec failed code=${code} err=${capField(err)} out=${capField(out)}`));
      });
    });
    try {
      proc.stdin.write(JSON.stringify(req));
      proc.stdin.end();
    } catch {
      // stdin may already be gone (timeout race) — close handler reports the failure
    }
    const timer = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {}
      done(() => reject(new Error("sandbox exec timeout")));
    }, (req.timeout_ms ?? 15000) + 2000);
  });
}

function localExec(req: SandboxExecRequest): Promise<SandboxExecResult> {
  return new Promise((resolve) => {
    const cmd = req.language === "bash" ? ["bash", "-c", req.code] : ["python3", "-c", req.code];
    const proc = spawn(cmd[0], cmd.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        proc.kill("SIGKILL");
      } catch {}
      resolve({ exitCode: 124, stdout, stderr: stderr + "\n[TIMEOUT]", timedOut: true });
    }, req.timeout_ms ?? 15000);
    const finish = (result: SandboxExecResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    proc.stdout.on("data", (d) => { if (!overCap(stdout, OUTPUT_MAX_BYTES)) stdout += d; });
    proc.stderr.on("data", (d) => { if (!overCap(stderr, OUTPUT_MAX_BYTES)) stderr += d; });
    proc.on("close", (code) => finish({ exitCode: code ?? 0, stdout: capField(stdout), stderr: capField(stderr), timedOut: false }));
    proc.on("error", (e) => finish({ exitCode: 1, stdout: "", stderr: String(e), timedOut: false }));
  });
}
