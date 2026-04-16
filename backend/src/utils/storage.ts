import { mkdir, rm, access } from "node:fs/promises";
import { join } from "node:path";

const STORAGE_BASE = "./storage/jobs";

export function getJobDir(jobId: string): string {
  return join(STORAGE_BASE, jobId);
}

export function getPagesDir(jobId: string): string {
  return join(STORAGE_BASE, jobId, "pages");
}

export function getOriginalPdfPath(jobId: string): string {
  return join(STORAGE_BASE, jobId, "original.pdf");
}

export function getOcrPdfPath(jobId: string): string {
  return join(STORAGE_BASE, jobId, "ocr.pdf");
}

export async function ensureJobDirs(jobId: string): Promise<void> {
  await mkdir(getPagesDir(jobId), { recursive: true });
}

export async function deleteJobFiles(jobId: string): Promise<void> {
  const dir = getJobDir(jobId);
  try {
    await access(dir);
    await rm(dir, { recursive: true, force: true });
  } catch {
    // directory doesn't exist, nothing to do
  }
}
