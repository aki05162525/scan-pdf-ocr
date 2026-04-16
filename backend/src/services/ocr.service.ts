import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getOriginalPdfPath, getOcrPdfPath } from "../utils/storage.js";
import { logger } from "../utils/logger.js";
import { updateJobStatus } from "./job.service.js";

const execFileAsync = promisify(execFile);

export async function runOcr(jobId: string, language: string): Promise<void> {
  const inputPath = getOriginalPdfPath(jobId);
  const outputPath = getOcrPdfPath(jobId);

  updateJobStatus(jobId, "ocr_running");

  try {
    await execFileAsync("ocrmypdf", [
      "-l",
      language,
      "--deskew",
      "--rotate-pages",
      "--force-ocr",
      "--clean",
      "--image-dpi",
      "300",
      "--optimize",
      "1",
      inputPath,
      outputPath,
    ]);

    updateJobStatus(jobId, "completed", { ocrPdfPath: outputPath });
    logger.info("OCR completed", { jobId });
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
  language: string
): Promise<void> {
  try {
    // Step 1: Generate PDF from images
    const { generatePdf } = await import("./pdf.service.js");
    const originalPdfPath = await generatePdf(jobId);
    updateJobStatus(jobId, "pdf_generated", { originalPdfPath });

    // Step 2: Run OCR
    await runOcr(jobId, language);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    updateJobStatus(jobId, "failed", { errorMessage: message });
    logger.error("Job processing failed", { jobId, error: message });
  }
}
