import { execFile } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { logger } from "../utils/logger.js";
import {
  getOcrPdfPath,
  getOriginalPdfPath,
  getPagesDir,
} from "../utils/storage.js";
import { updateJobStatus } from "./job.service.js";
import {
  buildSearchablePdf,
  type PageOcrResult,
  resolveFontPath,
} from "./searchable-pdf.service.js";
import { extractTextFromImage } from "./vision-ocr.service.js";

const execFileAsync = promisify(execFile);

const PDFTOPPM_DPI = 300;
const EXTRACT_PREFIX = "_ocr_extract";

export async function runOcr(jobId: string, language: string): Promise<void> {
  const inputPath = getOriginalPdfPath(jobId);
  const outputPath = getOcrPdfPath(jobId);
  const pagesDir = getPagesDir(jobId);

  updateJobStatus(jobId, "ocr_running");

  try {
    await execFileAsync("pdftoppm", [
      "-png",
      "-r",
      String(PDFTOPPM_DPI),
      inputPath,
      join(pagesDir, EXTRACT_PREFIX),
    ]);

    const extractedPages = (await readdir(pagesDir))
      .filter((f) => f.startsWith(`${EXTRACT_PREFIX}-`) && f.endsWith(".png"))
      .sort();

    const pageOcrResults: PageOcrResult[] = [];
    for (const file of extractedPages) {
      const imagePath = join(pagesDir, file);
      const result = await extractTextFromImage(imagePath, language);
      pageOcrResults.push(result);
    }

    await buildSearchablePdf({
      sourcePdfPath: inputPath,
      outputPath,
      pageOcrResults,
      fontPath: resolveFontPath(),
    });

    await Promise.all(
      extractedPages.map((file) =>
        rm(join(pagesDir, file), { force: true }).catch(() => undefined),
      ),
    );

    updateJobStatus(jobId, "completed", { ocrPdfPath: outputPath });
    logger.info("OCR completed", {
      jobId,
      pages: extractedPages.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown OCR error";
    updateJobStatus(jobId, "failed", { errorMessage: message });
    logger.error("OCR failed", { jobId, error: message });
    throw error;
  }
}

export async function processJob(
  jobId: string,
  language: string,
): Promise<void> {
  try {
    const { generatePdf } = await import("./pdf.service.js");
    const originalPdfPath = await generatePdf(jobId);
    updateJobStatus(jobId, "pdf_generated", { originalPdfPath });

    await runOcr(jobId, language);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    updateJobStatus(jobId, "failed", { errorMessage: message });
    logger.error("Job processing failed", { jobId, error: message });
  }
}
