import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock the services before importing routes
vi.mock("../services/job.service.js", () => ({
  createJob: vi.fn(),
  getJob: vi.fn(),
  listJobs: vi.fn(),
  deleteJob: vi.fn(),
  updateJobStatus: vi.fn(),
}));

vi.mock("../services/ocr.service.js", () => ({
  processJob: vi.fn(),
}));

// Import after mocking
const { createJob, getJob, listJobs, deleteJob } = await import(
  "../services/job.service.js"
);
const { processJob } = await import("../services/ocr.service.js");
const jobsRoute = (await import("./jobs.js")).default;

const app = new Hono();
app.route("/api/jobs", jobsRoute);

function createMockJob(overrides = {}) {
  return {
    id: "test-id-123",
    status: "uploaded",
    language: "jpn",
    pageCount: 2,
    errorMessage: null,
    hasOcrPdf: false,
    hasOriginalPdf: false,
    createdAt: "2026-04-17T10:00:00Z",
    updatedAt: "2026-04-17T10:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/jobs", () => {
  it("returns 400 when no images provided", async () => {
    const formData = new FormData();
    formData.append("language", "jpn");

    const res = await app.request("/api/jobs", {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No images provided");
  });

  it("returns 400 for unsupported file type", async () => {
    const formData = new FormData();
    const file = new File(["test"], "test.gif", { type: "image/gif" });
    formData.append("images", file);
    formData.append("language", "jpn");

    const res = await app.request("/api/jobs", {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Unsupported file type");
  });

  it("returns 400 for invalid language", async () => {
    const formData = new FormData();
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    formData.append("images", file);
    formData.append("language", "fra");

    const res = await app.request("/api/jobs", {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(400);
  });

  it("returns 201 and creates job with valid input", async () => {
    const mockJob = createMockJob();
    vi.mocked(createJob).mockResolvedValue(mockJob);
    vi.mocked(processJob).mockResolvedValue(undefined);

    const formData = new FormData();
    const file = new File(["imagedata"], "photo.jpg", { type: "image/jpeg" });
    formData.append("images", file);
    formData.append("language", "jpn");

    const res = await app.request("/api/jobs", {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("test-id-123");
    expect(json.status).toBe("uploaded");
    expect(createJob).toHaveBeenCalledOnce();
    expect(processJob).toHaveBeenCalledWith("test-id-123", "jpn");
  });

  it("accepts multiple images", async () => {
    const mockJob = createMockJob({ pageCount: 3 });
    vi.mocked(createJob).mockResolvedValue(mockJob);
    vi.mocked(processJob).mockResolvedValue(undefined);

    const formData = new FormData();
    formData.append("images", new File(["a"], "a.jpg", { type: "image/jpeg" }));
    formData.append("images", new File(["b"], "b.png", { type: "image/png" }));
    formData.append("images", new File(["c"], "c.jpeg", { type: "image/jpeg" }));
    formData.append("language", "jpn+eng");

    const res = await app.request("/api/jobs", {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(201);
    expect(processJob).toHaveBeenCalledWith(mockJob.id, "jpn+eng");
  });
});

describe("GET /api/jobs", () => {
  it("returns job list with defaults", async () => {
    const mockResult = {
      jobs: [createMockJob()],
      total: 1,
      page: 1,
      limit: 20,
    };
    vi.mocked(listJobs).mockResolvedValue(mockResult);

    const res = await app.request("/api/jobs");

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.jobs).toHaveLength(1);
    expect(json.total).toBe(1);
    expect(listJobs).toHaveBeenCalledWith(1, 20);
  });

  it("passes page and limit parameters", async () => {
    vi.mocked(listJobs).mockResolvedValue({
      jobs: [],
      total: 0,
      page: 2,
      limit: 10,
    });

    const res = await app.request("/api/jobs?page=2&limit=10");

    expect(res.status).toBe(200);
    expect(listJobs).toHaveBeenCalledWith(2, 10);
  });
});

describe("GET /api/jobs/:id", () => {
  it("returns 404 for non-existent job", async () => {
    vi.mocked(getJob).mockResolvedValue(null);

    const res = await app.request("/api/jobs/nonexistent");

    expect(res.status).toBe(404);
  });

  it("returns job detail", async () => {
    const mockJob = createMockJob({ status: "completed", hasOcrPdf: true });
    vi.mocked(getJob).mockResolvedValue(mockJob);

    const res = await app.request("/api/jobs/test-id-123");

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("completed");
    expect(json.hasOcrPdf).toBe(true);
  });
});

describe("DELETE /api/jobs/:id", () => {
  it("returns 404 for non-existent job", async () => {
    vi.mocked(deleteJob).mockResolvedValue(false);

    const res = await app.request("/api/jobs/nonexistent", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });

  it("returns 204 on successful deletion", async () => {
    vi.mocked(deleteJob).mockResolvedValue(true);

    const res = await app.request("/api/jobs/test-id-123", {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
    expect(deleteJob).toHaveBeenCalledWith("test-id-123");
  });
});
