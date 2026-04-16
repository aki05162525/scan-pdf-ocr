import { Hono } from "hono";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { stream } from "hono/streaming";
import {
  createJob,
  getJob,
  listJobs,
  deleteJob,
} from "../services/job.service.js";
import { processJob } from "../services/ocr.service.js";
import {
  createJobSchema,
  listJobsSchema,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  MAX_TOTAL_SIZE,
  MAX_PAGE_COUNT,
} from "../validators/job.validator.js";
import { logger } from "../utils/logger.js";
import { Readable } from "node:stream";

const app = new Hono();

// POST /api/jobs - Create job
app.post("/", async (c) => {
  const formData = await c.req.formData();
  const images = formData.getAll("images") as File[];
  const language = formData.get("language") as string | null;
  const pageOrder = formData.get("pageOrder") as string | null;

  // Validate files exist
  if (!images || images.length === 0) {
    return c.json({ error: "No images provided" }, 400);
  }

  // Validate page count
  if (images.length > MAX_PAGE_COUNT) {
    return c.json({ error: `Maximum ${MAX_PAGE_COUNT} pages allowed` }, 400);
  }

  // Validate each file
  let totalSize = 0;
  for (const image of images) {
    const ext = "." + image.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return c.json(
        { error: `Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
        400
      );
    }
    if (image.size > MAX_FILE_SIZE) {
      return c.json({ error: `File ${image.name} exceeds 20MB limit` }, 400);
    }
    totalSize += image.size;
  }
  if (totalSize > MAX_TOTAL_SIZE) {
    return c.json({ error: "Total upload size exceeds 100MB limit" }, 413);
  }

  // Validate other fields
  const parsed = createJobSchema.safeParse({
    language: language ?? undefined,
    pageOrder: pageOrder ?? undefined,
  });
  if (!parsed.success) {
    return c.json({ error: "Invalid parameters", details: parsed.error.issues }, 400);
  }

  const job = await createJob({
    images,
    language: parsed.data.language,
    pageOrder: parsed.data.pageOrder,
  });

  logger.info("Job created", { jobId: job.id });

  // Start background processing
  processJob(job.id, parsed.data.language);

  return c.json(job, 201);
});

// GET /api/jobs - List jobs
app.get("/", async (c) => {
  const parsed = listJobsSchema.safeParse({
    page: c.req.query("page"),
    limit: c.req.query("limit"),
  });
  if (!parsed.success) {
    return c.json({ error: "Invalid parameters" }, 400);
  }

  const result = await listJobs(parsed.data.page, parsed.data.limit);
  return c.json(result);
});

// GET /api/jobs/:id - Get job detail
app.get("/:id", async (c) => {
  const job = await getJob(c.req.param("id"));
  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }
  return c.json(job);
});

// GET /api/jobs/:id/files/ocr-pdf - Download OCR PDF
app.get("/:id/files/ocr-pdf", async (c) => {
  const job = await getJob(c.req.param("id"));
  if (!job || !job.hasOcrPdf) {
    return c.json({ error: "OCR PDF not found" }, 404);
  }

  const { getOcrPdfPath } = await import("../utils/storage.js");
  const filePath = getOcrPdfPath(c.req.param("id"));

  try {
    await access(filePath);
  } catch {
    return c.json({ error: "File not found" }, 404);
  }

  const date = job.createdAt.split("T")[0] ?? new Date().toISOString().split("T")[0];
  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="scan_${date}_ocr.pdf"`);

  return stream(c, async (s) => {
    const nodeStream = createReadStream(filePath);
    const reader = Readable.toWeb(nodeStream).getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await s.write(value);
      }
    } finally {
      reader.releaseLock();
    }
  });
});

// GET /api/jobs/:id/files/original-pdf - Download original PDF
app.get("/:id/files/original-pdf", async (c) => {
  const job = await getJob(c.req.param("id"));
  if (!job || !job.hasOriginalPdf) {
    return c.json({ error: "Original PDF not found" }, 404);
  }

  const { getOriginalPdfPath } = await import("../utils/storage.js");
  const filePath = getOriginalPdfPath(c.req.param("id"));

  try {
    await access(filePath);
  } catch {
    return c.json({ error: "File not found" }, 404);
  }

  const date = job.createdAt.split("T")[0] ?? new Date().toISOString().split("T")[0];
  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="scan_${date}_original.pdf"`);

  return stream(c, async (s) => {
    const nodeStream = createReadStream(filePath);
    const reader = Readable.toWeb(nodeStream).getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await s.write(value);
      }
    } finally {
      reader.releaseLock();
    }
  });
});

// DELETE /api/jobs/:id - Delete job
app.delete("/:id", async (c) => {
  const deleted = await deleteJob(c.req.param("id"));
  if (!deleted) {
    return c.json({ error: "Job not found" }, 404);
  }
  return c.body(null, 204);
});

export default app;
