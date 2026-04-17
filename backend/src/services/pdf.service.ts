import { execFile } from "node:child_process";
import { readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { logger } from "../utils/logger.js";
import { getOriginalPdfPath, getPagesDir } from "../utils/storage.js";

const execFileAsync = promisify(execFile);

// B5: 176mm x 250mm at 300 DPI
const DPI = 300;
const B5_WIDTH_PX = Math.round((176 / 25.4) * DPI); // 2079
const B5_HEIGHT_PX = Math.round((250 / 25.4) * DPI); // 2953
const PAGE_PDF_PREFIX = "_page_";
const PREPARED_IMAGE_PREFIX = "_ocr_ready_";

function isSourceImageFile(filename: string): boolean {
  return (
    /\.(jpg|jpeg|png)$/i.test(filename) &&
    !filename.startsWith(PREPARED_IMAGE_PREFIX)
  );
}

export async function listPreparedImages(jobId: string): Promise<string[]> {
  const pagesDir = getPagesDir(jobId);
  const files = await readdir(pagesDir);
  return files
    .filter(
      (f) =>
        f.startsWith(PREPARED_IMAGE_PREFIX) && f.toLowerCase().endsWith(".png"),
    )
    .sort()
    .map((f) => join(pagesDir, f));
}

export async function generatePdf(jobId: string): Promise<string> {
  const pagesDir = getPagesDir(jobId);
  const outputPath = getOriginalPdfPath(jobId);

  const files = await readdir(pagesDir);
  await Promise.all(
    files
      .filter(
        (f) =>
          f.startsWith(PAGE_PDF_PREFIX) || f.startsWith(PREPARED_IMAGE_PREFIX),
      )
      .map((f) => rm(join(pagesDir, f), { force: true })),
  );

  const imageFiles = files
    .filter(isSourceImageFile)
    .sort()
    .map((f) => join(pagesDir, f));

  if (imageFiles.length === 0) {
    throw new Error("No image files found");
  }

  const pagePdfs: string[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const pageId = String(i).padStart(3, "0");
    const preparedImage = join(pagesDir, `${PREPARED_IMAGE_PREFIX}${pageId}.png`);
    const pagePdf = join(pagesDir, `${PAGE_PDF_PREFIX}${pageId}.pdf`);
    pagePdfs.push(pagePdf);

    // 1. Auto-orient (EXIF rotation)
    // 2. Shading correction: divide image by a heavily-blurred copy to flatten
    //    uneven illumination from scanners/phone cameras, then normalize contrast
    // 3. Deskew (straighten skewed scans)
    // 4. Resize to fit B5 at 300DPI, preserve aspect ratio and colorspace
    // 5. Place centered on white B5 canvas
    // 6. Save a prepared raster once and reuse it for both OCR and PDF generation
    await execFileAsync("convert", [
      imageFiles[i],
      "-auto-orient",
      "(",
      "+clone",
      "-blur",
      "0x30",
      ")",
      "-compose",
      "Divide_Src",
      "-composite",
      // Reset compose so subsequent ops (e.g. -extent) don't divide-blend
      "-compose",
      "Over",
      "-normalize",
      "-deskew",
      "40%",
      "-colorspace",
      "sRGB",
      "-resize",
      `${B5_WIDTH_PX}x${B5_HEIGHT_PX}`,
      "-background",
      "white",
      "-gravity",
      "center",
      "-extent",
      `${B5_WIDTH_PX}x${B5_HEIGHT_PX}`,
      preparedImage,
    ]);

    await execFileAsync("convert", [
      preparedImage,
      "-units",
      "PixelsPerInch",
      "-density",
      String(DPI),
      pagePdf,
    ]);
  }

  if (pagePdfs.length === 1) {
    await rename(pagePdfs[0], outputPath);
  } else {
    await execFileAsync("gs", [
      "-q",
      "-dNOPAUSE",
      "-dBATCH",
      "-sDEVICE=pdfwrite",
      `-sOutputFile=${outputPath}`,
      ...pagePdfs,
    ]);

    for (const p of pagePdfs) {
      await rm(p, { force: true });
    }
  }

  logger.info("PDF generated", { jobId, pageCount: imageFiles.length });
  return outputPath;
}
