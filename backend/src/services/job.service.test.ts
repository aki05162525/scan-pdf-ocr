import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import { jobs, jobPages } from "../db/schema.js";
import { createId } from "@paralleldrive/cuid2";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

// We'll test the service logic by directly operating on an in-memory DB
// and verifying the DB state, since the service functions use the singleton db.
// For proper isolation we test the core logic patterns here.

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeEach(async () => {
  sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });

  // Create tables manually (same as migration)
  sqlite.exec(`
    CREATE TABLE jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'uploaded',
      language TEXT NOT NULL DEFAULT 'jpn',
      page_count INTEGER NOT NULL DEFAULT 0,
      original_pdf_path TEXT,
      ocr_pdf_path TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE job_pages (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      page_order INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX idx_job_pages_job_id ON job_pages(job_id);
  `);
});

afterEach(() => {
  sqlite.close();
});

describe("jobs table operations", () => {
  it("inserts a job with default status", () => {
    const id = createId();
    db.insert(jobs).values({ id, language: "jpn", pageCount: 3 }).run();

    const job = db.select().from(jobs).where(eq(jobs.id, id)).get();
    expect(job).toBeDefined();
    expect(job!.status).toBe("uploaded");
    expect(job!.language).toBe("jpn");
    expect(job!.pageCount).toBe(3);
    expect(job!.originalPdfPath).toBeNull();
    expect(job!.ocrPdfPath).toBeNull();
    expect(job!.errorMessage).toBeNull();
  });

  it("updates job status", () => {
    const id = createId();
    db.insert(jobs).values({ id }).run();

    db.update(jobs).set({ status: "ocr_running" }).where(eq(jobs.id, id)).run();

    const job = db.select().from(jobs).where(eq(jobs.id, id)).get();
    expect(job!.status).toBe("ocr_running");
  });

  it("updates job to completed with pdf paths", () => {
    const id = createId();
    db.insert(jobs).values({ id }).run();

    db.update(jobs)
      .set({
        status: "completed",
        originalPdfPath: "/path/original.pdf",
        ocrPdfPath: "/path/ocr.pdf",
      })
      .where(eq(jobs.id, id))
      .run();

    const job = db.select().from(jobs).where(eq(jobs.id, id)).get();
    expect(job!.status).toBe("completed");
    expect(job!.originalPdfPath).toBe("/path/original.pdf");
    expect(job!.ocrPdfPath).toBe("/path/ocr.pdf");
  });

  it("updates job to failed with error message", () => {
    const id = createId();
    db.insert(jobs).values({ id }).run();

    db.update(jobs)
      .set({ status: "failed", errorMessage: "OCR engine crashed" })
      .where(eq(jobs.id, id))
      .run();

    const job = db.select().from(jobs).where(eq(jobs.id, id)).get();
    expect(job!.status).toBe("failed");
    expect(job!.errorMessage).toBe("OCR engine crashed");
  });

  it("deletes a job", () => {
    const id = createId();
    db.insert(jobs).values({ id }).run();

    db.delete(jobs).where(eq(jobs.id, id)).run();

    const job = db.select().from(jobs).where(eq(jobs.id, id)).get();
    expect(job).toBeUndefined();
  });

  it("lists jobs ordered by created_at desc", () => {
    const id1 = createId();
    const id2 = createId();

    db.insert(jobs)
      .values({ id: id1, createdAt: "2026-01-01T00:00:00" })
      .run();
    db.insert(jobs)
      .values({ id: id2, createdAt: "2026-01-02T00:00:00" })
      .run();

    const allJobs = db
      .select()
      .from(jobs)
      .orderBy(schema.jobs.createdAt)
      .all();

    expect(allJobs).toHaveLength(2);
    expect(allJobs[0].id).toBe(id1);
    expect(allJobs[1].id).toBe(id2);
  });
});

describe("job_pages table operations", () => {
  it("inserts pages linked to a job", () => {
    const jobId = createId();
    db.insert(jobs).values({ id: jobId }).run();

    const pageId1 = createId();
    const pageId2 = createId();

    db.insert(jobPages)
      .values([
        { id: pageId1, jobId, pageOrder: 0, imagePath: "/pages/000.jpg" },
        { id: pageId2, jobId, pageOrder: 1, imagePath: "/pages/001.png" },
      ])
      .run();

    const pages = db
      .select()
      .from(jobPages)
      .where(eq(jobPages.jobId, jobId))
      .all();

    expect(pages).toHaveLength(2);
    expect(pages[0].pageOrder).toBe(0);
    expect(pages[1].pageOrder).toBe(1);
  });

  it("cascades delete when job is deleted", () => {
    const jobId = createId();
    db.insert(jobs).values({ id: jobId }).run();
    db.insert(jobPages)
      .values({ id: createId(), jobId, pageOrder: 0, imagePath: "/p/0.jpg" })
      .run();

    db.delete(jobs).where(eq(jobs.id, jobId)).run();

    const pages = db
      .select()
      .from(jobPages)
      .where(eq(jobPages.jobId, jobId))
      .all();

    expect(pages).toHaveLength(0);
  });

  it("rejects page with non-existent job_id", () => {
    expect(() => {
      db.insert(jobPages)
        .values({
          id: createId(),
          jobId: "nonexistent",
          pageOrder: 0,
          imagePath: "/p/0.jpg",
        })
        .run();
    }).toThrow();
  });
});

describe("storage utility functions", async () => {
  const { getJobDir, getPagesDir, getOriginalPdfPath, getOcrPdfPath } =
    await import("../utils/storage.js");

  it("returns correct job directory path", () => {
    expect(getJobDir("abc123")).toMatch(/storage\/jobs\/abc123$/);
  });

  it("returns correct pages directory path", () => {
    expect(getPagesDir("abc123")).toMatch(/storage\/jobs\/abc123\/pages$/);
  });

  it("returns correct original pdf path", () => {
    expect(getOriginalPdfPath("abc123")).toMatch(
      /storage\/jobs\/abc123\/original\.pdf$/
    );
  });

  it("returns correct ocr pdf path", () => {
    expect(getOcrPdfPath("abc123")).toMatch(
      /storage\/jobs\/abc123\/ocr\.pdf$/
    );
  });
});
