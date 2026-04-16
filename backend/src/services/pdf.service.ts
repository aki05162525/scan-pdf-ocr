import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { getPagesDir, getOriginalPdfPath } from "../utils/storage.js";
import { logger } from "../utils/logger.js";

const execFileAsync = promisify(execFile);

export async function generatePdf(jobId: string): Promise<string> {
  const pagesDir = getPagesDir(jobId);
  const outputPath = getOriginalPdfPath(jobId);

  // Get sorted image files
  const files = await readdir(pagesDir);
  const imageFiles = files
    .filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
    .sort()
    .map((f) => join(pagesDir, f));

  if (imageFiles.length === 0) {
    throw new Error("No image files found");
  }

  // Use ImageMagick convert to combine images into PDF
  await execFileAsync("convert", [...imageFiles, outputPath]);

  logger.info("PDF generated", { jobId, pageCount: imageFiles.length });

  return outputPath;
}
