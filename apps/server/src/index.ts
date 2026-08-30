import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { missionsRouter } from "./routes/missions.js";
import { streamRouter } from "./routes/stream.js";
import { verifyRouter } from "./routes/verify.js";
import { harnessRouter } from "./routes/harness.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: CORS_ORIGIN }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "omniforge-server", version: "0.1.0", time: new Date().toISOString() })
);

app.use("/api/missions", missionsRouter);
app.use("/api/stream", streamRouter);
app.use("/api/verify", verifyRouter);
app.use("/api/harness", harnessRouter);

// Fallback for unknown routes
app.use((_req, res) => res.status(404).json({ error: "not found" }));

app.listen(PORT, () => {
  console.log(`OmniForge server listening on http://localhost:${PORT}`);
  console.log(`   CORS origin: ${CORS_ORIGIN}`);
  console.log(`   Health:      http://localhost:${PORT}/api/health`);
  console.log(`   Harness:     http://localhost:${PORT}/api/harness/health  (proxies ${process.env.TRUEFORGE_API_URL ?? "http://localhost:8790"}/api/v1)`);
  console.log(`   Verify:      http://localhost:${PORT}/api/verify/latest  (Muse audits Codex fixes)`);
});
