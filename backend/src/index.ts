import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import jobsRoute from "./routes/jobs.js";
import { logger } from "./utils/logger.js";

const app = new Hono();

// Middleware
app.use(
  "/api/*",
  cors({
    origin: "http://localhost:3000",
    allowMethods: ["GET", "POST", "DELETE"],
  })
);

// Routes
app.route("/api/jobs", jobsRoute);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

const port = 3001;
logger.info(`Server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
