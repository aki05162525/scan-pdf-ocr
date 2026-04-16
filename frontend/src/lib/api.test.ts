import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createJob,
  deleteJob,
  getJob,
  getOcrPdfUrl,
  getOriginalPdfUrl,
  listJobs,
} from "./api";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createJob", () => {
  it("sends POST with FormData and returns job", async () => {
    const mockJob = { id: "abc", status: "uploaded" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJob),
    });

    const files = [new File(["data"], "test.jpg", { type: "image/jpeg" })];
    const result = await createJob(files, "jpn");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/jobs");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect(result).toEqual(mockJob);
  });

  it("includes pageOrder when provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "abc" }),
    });

    const files = [
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
    ];
    await createJob(files, "jpn", [1, 0]);

    const formData = mockFetch.mock.calls[0][1].body as FormData;
    expect(formData.get("pageOrder")).toBe("[1,0]");
  });

  it("throws on error response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Bad request" }),
    });

    const files = [new File(["data"], "test.jpg")];
    await expect(createJob(files, "jpn")).rejects.toThrow("Bad request");
  });
});

describe("getJob", () => {
  it("fetches job by id", async () => {
    const mockJob = { id: "abc", status: "completed" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJob),
    });

    const result = await getJob("abc");
    expect(result).toEqual(mockJob);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/jobs/abc"),
    );
  });

  it("throws on 404", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    await expect(getJob("nonexistent")).rejects.toThrow("Job not found");
  });
});

describe("listJobs", () => {
  it("fetches with default pagination", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobs: [], total: 0, page: 1, limit: 20 }),
    });

    await listJobs();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("page=1&limit=20"),
    );
  });

  it("passes custom page and limit", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobs: [], total: 0, page: 3, limit: 10 }),
    });

    await listJobs(3, 10);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("page=3&limit=10"),
    );
  });
});

describe("deleteJob", () => {
  it("sends DELETE request", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await deleteJob("abc");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/jobs/abc");
    expect(options.method).toBe("DELETE");
  });

  it("throws on failure", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    await expect(deleteJob("abc")).rejects.toThrow("Failed to delete job");
  });
});

describe("URL helpers", () => {
  it("getOcrPdfUrl returns correct URL", () => {
    expect(getOcrPdfUrl("abc")).toContain("/jobs/abc/files/ocr-pdf");
  });

  it("getOriginalPdfUrl returns correct URL", () => {
    expect(getOriginalPdfUrl("abc")).toContain("/jobs/abc/files/original-pdf");
  });
});
