import { spawn } from "node:child_process";
import type { SandboxExecRequest, SandboxExecResult } from "./types.js";

/**
 * Execute code inside the local sandbox container if available,
 * otherwise fall back to local subprocess (dev mode without Docker).
 */
export async function sandboxExec(req: SandboxExecRequest): Promise<SandboxExecResult> {
  const useDocker = process.env.SANDBOX_DOCKER !== "false" && process.env.SANDBOX_DOCKER !== "0";
  if (useDocker) {
    try {
      return await dockerExec(req);
    } catch {
      // fallback to local
    }
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
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (out) {
        try {
          resolve(JSON.parse(out));
          return;
        } catch {}
      }
      reject(new Error(`sandbox exec failed code=${code} err=${err} out=${out}`));
    });
    proc.stdin.write(JSON.stringify(req));
    proc.stdin.end();
    setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {}
      reject(new Error("sandbox exec timeout"));
    }, (req.timeout_ms ?? 15000) + 2000);
  });
}

function localExec(req: SandboxExecRequest): Promise<SandboxExecResult> {
  return new Promise((resolve) => {
    const cmd = req.language === "bash" ? ["bash", "-c", req.code] : ["python3", "-c", req.code];
    const proc = spawn(cmd[0], cmd.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("close", (code) => resolve({ exitCode: code ?? 0, stdout, stderr, timedOut: false }));
    proc.on("error", (e) => resolve({ exitCode: 1, stdout: "", stderr: String(e), timedOut: false }));
    setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {}
      resolve({ exitCode: 124, stdout, stderr: stderr + "\n[TIMEOUT]", timedOut: true });
    }, req.timeout_ms ?? 15000);
  });
}
