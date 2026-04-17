import { rm } from "node:fs/promises";
import { logger } from "../utils/logger.js";
import {
  getOcrPdfPath,
  getOriginalPdfPath,
} from "../utils/storage.js";
import { updateJobStatus } from "./job.service.js";
import { generatePdf, listPreparedImages } from "./pdf.service.js";
import {
  buildSearchablePdf,
  type PageOcrResult,
  resolveFontPath,
} from "./searchable-pdf.service.js";
import { extractTextFromImage } from "./vision-ocr.service.js";

export async function runOcr(jobId: string, language: string): Promise<void> {
  const inputPath = getOriginalPdfPath(jobId);
  const outputPath = getOcrPdfPath(jobId);
  let preparedImages: string[] = [];

  updateJobStatus(jobId, "ocr_running");

  try {
    preparedImages = await listPreparedImages(jobId);
    if (preparedImages.length === 0) {
      throw new Error("No prepared OCR images found");
    }

    const pageOcrResults: PageOcrResult[] = [];
    for (const imagePath of preparedImages) {
      const result = await extractTextFromImage(imagePath, language);
      pageOcrResults.push(result);
    }

    await buildSearchablePdf({
      sourcePdfPath: inputPath,
      outputPath,
      pageOcrResults,
      fontPath: resolveFontPath(),
    });

    updateJobStatus(jobId, "completed", { ocrPdfPath: outputPath });
    logger.info("OCR completed", {
      jobId,
      pages: preparedImages.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown OCR error";
    updateJobStatus(jobId, "failed", { errorMessage: message });
    logger.error("OCR failed", { jobId, error: message });
    throw error;
  } finally {
    await Promise.all(
      preparedImages.map((imagePath) =>
        rm(imagePath, { force: true }).catch(() => undefined),
      ),
    );
  }
}

export async function processJob(
  jobId: string,
  language: string,
): Promise<void> {
  try {
    const originalPdfPath = await generatePdf(jobId);
    updateJobStatus(jobId, "pdf_generated", { originalPdfPath });

    await runOcr(jobId, language);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    updateJobStatus(jobId, "failed", { errorMessage: message });
    logger.error("Job processing failed", { jobId, error: message });
  }
}
