import express from "express";
import cors from "cors";
import { missionsRouter } from "./routes/missions.js";
import { streamRouter } from "./routes/stream.js";
import { verifyRouter } from "./routes/verify.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "omniforge-server", version: "0.1.0", time: new Date().toISOString() })
);

app.use("/api/missions", missionsRouter);
app.use("/api/stream", streamRouter);
app.use("/api/verify", verifyRouter);

// Fallback for unknown routes
app.use((_req, res) => res.status(404).json({ error: "not found" }));

app.listen(PORT, () => {
  console.log(`⚡ OmniForge server listening on http://localhost:${PORT}`);
  console.log(`   CORS origin: ${CORS_ORIGIN}`);
  console.log(`   Health:      http://localhost:${PORT}/api/health`);
  console.log(`   Verify:      http://localhost:${PORT}/api/verify/latest  (Muse audits Codex fixes)`);
});
