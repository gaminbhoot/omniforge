import { describe, it, expect } from "vitest";
import { checkSystemHealth } from "./healthcheck.js";

describe("healthcheck utility", () => {
  it("should return healthy status with uptime and timestamp", () => {
    const status = checkSystemHealth("test-service");
    expect(status.service).toBe("test-service");
    expect(status.healthy).toBe(true);
    expect(typeof status.timestamp).toBe("string");
    expect(status.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it("should report unhealthy when a dependency fails", () => {
    const status = checkSystemHealth("test-service", { sandbox: true, harness: false });
    expect(status.healthy).toBe(false);
  });

  it("should report healthy when all dependencies pass", () => {
    const status = checkSystemHealth("test-service", { sandbox: true, harness: true });
    expect(status.healthy).toBe(true);
  });
});
