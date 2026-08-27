import { spawn } from "node:child_process";
import type { SandboxExecRequest, SandboxExecResult } from "./types.js";

/**
 * Execute code inside the local sandbox container if available,
 * otherwise fall back to local subprocess (dev mode without Docker).
 *
 * Fail-closed in production: if Docker is required but unavailable,
 * throw instead of falling back to host exec (SA-03).
 */
export async function sandboxExec(req: SandboxExecRequest): Promise<SandboxExecResult> {
  const useDocker = process.env.SANDBOX_DOCKER !== "false" && process.env.SANDBOX_DOCKER !== "0";
  const isProd = process.env.NODE_ENV === "production" || process.env.SANDBOX_DOCKER === "true";
  if (useDocker) {
    try {
      return await dockerExec(req);
    } catch (e) {
      if (isProd) throw new Error(`sandbox Docker required but unavailable: ${String((e as Error).message ?? e)}`);
      // dev fallback with warning
      console.warn("[sandboxExec] dockerExec failed, falling back to local (dev-only):", (e as Error).message);
    }
  } else if (isProd) {
    throw new Error("sandbox Docker required in production (SANDBOX_DOCKER=false is dev-only)");
  }
  return localExec(req);
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
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("error", (e) => done(() => reject(e)));
    proc.on("close", (code) => {
      done(() => {
        if (out) {
          try {
            resolve(JSON.parse(out));
            return;
          } catch {}
        }
        reject(new Error(`sandbox exec failed code=${code} err=${err} out=${out}`));
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
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("close", (code) => finish({ exitCode: code ?? 0, stdout, stderr, timedOut: false }));
    proc.on("error", (e) => finish({ exitCode: 1, stdout: "", stderr: String(e), timedOut: false }));
  });
}
