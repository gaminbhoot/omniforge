/**
 * Healthcheck & status verification utility for OmniForge runtime.
 */
export interface SystemStatus {
  service: string;
  healthy: boolean;
  timestamp: string;
  uptimeSeconds: number;
}

export function checkSystemHealth(
  serviceName: string,
  deps: Record<string, boolean> = {},
): SystemStatus {
  return {
    service: serviceName,
    healthy: Object.values(deps).every(Boolean),
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
  };
}
