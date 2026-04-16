import { writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import type { Job } from "../db/schema.js";
import { jobPages, jobs } from "../db/schema.js";
import {
  deleteJobFiles,
  ensureJobDirs,
  getPagesDir,
} from "../utils/storage.js";

export interface CreateJobInput {
  images: File[];
  language: string;
  pageOrder?: number[];
}

function toJobResponse(job: Job) {
  return {
    id: job.id,
    status: job.status,
    language: job.language,
    pageCount: job.pageCount,
    errorMessage: job.errorMessage,
    hasOcrPdf: !!job.ocrPdfPath,
    hasOriginalPdf: !!job.originalPdfPath,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export async function createJob(input: CreateJobInput) {
  const jobId = createId();
  await ensureJobDirs(jobId);

  const orderedImages = input.pageOrder
    ? input.pageOrder.map((i) => input.images[i])
    : input.images;

  // Save images to disk
  const pageRecords = [];
  for (let i = 0; i < orderedImages.length; i++) {
    const image = orderedImages[i];
    const ext = extname(image.name).toLowerCase();
    const filename = `${String(i).padStart(3, "0")}${ext}`;
    const filepath = join(getPagesDir(jobId), filename);

    const buffer = Buffer.from(await image.arrayBuffer());
    await writeFile(filepath, buffer);

    pageRecords.push({
      id: createId(),
      jobId,
      pageOrder: i,
      imagePath: filepath,
    });
  }

  // Insert into DB
  db.insert(jobs)
    .values({
      id: jobId,
      status: "uploaded",
      language: input.language,
      pageCount: orderedImages.length,
    })
    .run();

  for (const page of pageRecords) {
    db.insert(jobPages).values(page).run();
  }

  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get()!;
  return toJobResponse(job);
}

export async function getJob(jobId: string) {
  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) return null;
  return toJobResponse(job);
}

export async function listJobs(page: number, limit: number) {
  const offset = (page - 1) * limit;

  const jobList = db
    .select()
    .from(jobs)
    .orderBy(desc(jobs.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const [totalResult] = db.select({ count: count() }).from(jobs).all();

  return {
    jobs: jobList.map(toJobResponse),
    total: totalResult.count,
    page,
    limit,
  };
}

export async function deleteJob(jobId: string) {
  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) return false;

  db.delete(jobs).where(eq(jobs.id, jobId)).run();
  await deleteJobFiles(jobId);
  return true;
}

export function updateJobStatus(
  jobId: string,
  status: string,
  extra?: Partial<{
    originalPdfPath: string;
    ocrPdfPath: string;
    errorMessage: string;
  }>,
) {
  db.update(jobs)
    .set({
      status,
      updatedAt: sql`(datetime('now'))`,
      ...extra,
    })
    .where(eq(jobs.id, jobId))
    .run();
}
