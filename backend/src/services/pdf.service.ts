import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { getPagesDir, getOriginalPdfPath } from "../utils/storage.js";
import { logger } from "../utils/logger.js";

const execFileAsync = promisify(execFile);

// B5: 176mm x 250mm = 498.9pt x 708.66pt (at 72 DPI)
const B5_WIDTH_PT = 498.9;
const B5_HEIGHT_PT = 708.66;

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

  // Convert each image to a B5-sized PDF page, then combine
  // For each image: resize to fit B5 (maintain aspect ratio), center on white B5 canvas
  const pagePdfs: string[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const pagePdf = join(pagesDir, `_page_${String(i).padStart(3, "0")}.pdf`);
    pagePdfs.push(pagePdf);

    await execFileAsync("convert", [
      imageFiles[i],
      "-resize",
      `${B5_WIDTH_PT}x${B5_HEIGHT_PT}`,
      "-background",
      "white",
      "-gravity",
      "center",
      "-extent",
      `${B5_WIDTH_PT}x${B5_HEIGHT_PT}`,
      "-units",
      "PixelsPerInch",
      "-density",
      "72",
      `PDF:${pagePdf}`,
    ]);
  }

  if (pagePdfs.length === 1) {
    // Single page - just rename
    const { rename } = await import("node:fs/promises");
    await rename(pagePdfs[0], outputPath);
  } else {
    // Combine with Ghostscript for reliable multi-page PDF
    await execFileAsync("gs", [
      "-q",
      "-dNOPAUSE",
      "-dBATCH",
      "-sDEVICE=pdfwrite",
      `-sOutputFile=${outputPath}`,
      ...pagePdfs,
    ]);

    // Clean up temp page PDFs
    const { rm } = await import("node:fs/promises");
    for (const p of pagePdfs) {
      await rm(p, { force: true });
    }
  }

  logger.info("PDF generated", { jobId, pageCount: imageFiles.length });

  return outputPath;
}
