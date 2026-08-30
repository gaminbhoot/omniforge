import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { missionsRouter } from "./routes/missions.js";
import { streamRouter } from "./routes/stream.js";
import { verifyRouter } from "./routes/verify.js";
import { harnessRouter } from "./routes/harness.js";

const app = express();const PORT = Number(process.env.PORT ?? 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: CORS_ORIGIN }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }));
app.use(express.json({ limit: "1mb" }));

// Opt-in API auth (SA-04): when OMNIFORGE_TOKEN is set, every mutating (non-GET)
// request must present it as the X-API-Key header. Unset (default) keeps
// zero-configuration local development working. Read per-request so the
// feature is testable and takes effect without a rebuild.
app.use((req, res, next) => {
  const token = process.env.OMNIFORGE_TOKEN;
  if (!token) return next();
  if (req.method === "GET") return next();
  if (req.headers["x-api-key"] === token) return next();
  res.status(401).json({ error: "unauthorized — send the OMNIFORGE_TOKEN value as the X-API-Key header" });
});

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "omniforge-server", version: "0.1.0", time: new Date().toISOString() })
);

app.use("/api/missions", missionsRouter);
app.use("/api/stream", streamRouter);
app.use("/api/verify", verifyRouter);
app.use("/api/harness", harnessRouter);

// Global JSON error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[server error]", err);
  const status = typeof err?.status === "number" ? err.status : 500;
  res.status(status).json({ error: err?.message ?? "internal server error" });
});

// Fallback for unknown routes
app.use((_req, res) => res.status(404).json({ error: "not found" }));

// Exported for HTTP contract tests (supertest); the listener only starts
// outside test runs.
export { app };

if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`OmniForge server listening on http://localhost:${PORT}`);
    console.log(`   CORS origin: ${CORS_ORIGIN}`);
    console.log(`   Health:      http://localhost:${PORT}/api/health`);
    console.log(`   Harness:     http://localhost:${PORT}/api/harness/health  (proxies ${process.env.TRUEFORGE_API_URL ?? "http://localhost:8790"}/api/v1)`);
    console.log(`   Verify:      http://localhost:${PORT}/api/verify/latest  (spec verdicts)`);
  });
}
