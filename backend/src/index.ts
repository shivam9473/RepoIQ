import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

import express from "express";
import cors from "cors";
import "express-async-errors";
import { pool } from "./db/pool.js";
import { migrate } from "./db/migrate.js";
import { authRouter } from "./routes/auth.js";
import { reposRouter } from "./routes/repos.js";
import { chatRouter } from "./routes/chat.js";
import { insightsRouter } from "./routes/insights.js";
import { dashboardRouter } from "./routes/dashboard.js";

async function main() {
  await migrate();

  const app = express();
  app.use(
    cors({
      origin: process.env.APP_URL || "http://localhost:5173",
      credentials: true,
    })
  );
  app.use(express.json({ limit: "5mb" }));

  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", service: "backend" });
    } catch {
      res.status(503).json({ status: "degraded", service: "backend" });
    }
  });

  app.use("/api/auth", authRouter);
  app.use("/api/repos", reposRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/insights", insightsRouter);
  app.use("/api/dashboard", dashboardRouter);

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error(err);
      res.status(500).json({
        success: false,
        error: err.message || "Internal server error",
      });
    }
  );

  const port = Number(process.env.BACKEND_PORT || 4000);
  app.listen(port, () => {
    console.log(`CodeAtlas backend listening on :${port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start backend", err);
  process.exit(1);
});
