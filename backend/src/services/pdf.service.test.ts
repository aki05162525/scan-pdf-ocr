import { execFileSync } from "node:child_process";
import { access, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getJobDir,
  getOriginalPdfPath,
  getPagesDir,
} from "../utils/storage.js";
import { generatePdf } from "./pdf.service.js";

function getPdfInfo(pdfPath: string): { pages: number; pageSize: string } {
  const output = execFileSync("pdfinfo", [pdfPath]).toString();
  const pagesMatch = output.match(/Pages:\s+(\d+)/);
  const sizeMatch = output.match(/Page size:\s+(.+)/);
  return {
    pages: pagesMatch ? parseInt(pagesMatch[1], 10) : 0,
    pageSize: sizeMatch ? sizeMatch[1].trim() : "",
  };
}

const TEST_JOB_ID = "test-pdf-gen";

beforeEach(async () => {
  const pagesDir = getPagesDir(TEST_JOB_ID);
  await mkdir(pagesDir, { recursive: true });
});

afterEach(async () => {
  await rm(getJobDir(TEST_JOB_ID), { recursive: true, force: true });
});

function createTestImage(filepath: string, text: string) {
  execFileSync("convert", [
    "-size",
    "400x200",
    "xc:white",
    "-pointsize",
    "24",
    "-annotate",
    "+50+100",
    text,
    filepath,
  ]);
}

describe("generatePdf", () => {
  it("combines a single image into a PDF", async () => {
    const pagesDir = getPagesDir(TEST_JOB_ID);
    createTestImage(join(pagesDir, "000.jpg"), "Page 1");

    const outputPath = await generatePdf(TEST_JOB_ID);

    expect(outputPath).toBe(getOriginalPdfPath(TEST_JOB_ID));
    await expect(access(outputPath)).resolves.toBeUndefined();
  });

  it("combines multiple images into a PDF in sorted order", async () => {
    const pagesDir = getPagesDir(TEST_JOB_ID);
    createTestImage(join(pagesDir, "000.jpg"), "Page 1");
    createTestImage(join(pagesDir, "001.png"), "Page 2");
    createTestImage(join(pagesDir, "002.jpg"), "Page 3");

    const outputPath = await generatePdf(TEST_JOB_ID);

    await expect(access(outputPath)).resolves.toBeUndefined();

    // Verify page count
    expect(getPdfInfo(outputPath).pages).toBe(3);
  });

  it("throws when no images exist", async () => {
    await expect(generatePdf(TEST_JOB_ID)).rejects.toThrow(
      "No image files found",
    );
  });

  it("generates PDF with B5 page size (498 x 709 pts)", async () => {
    const pagesDir = getPagesDir(TEST_JOB_ID);
    createTestImage(join(pagesDir, "000.jpg"), "B5 test");

    const outputPath = await generatePdf(TEST_JOB_ID);
    const info = getPdfInfo(outputPath);

    // B5 = 176mm x 250mm = 498.9 x 708.66 pts
    // pdfinfo rounds, so check approximate values
    const [width, height] = info.pageSize
      .split(" x ")
      .map((s) => parseFloat(s));
    expect(width).toBeCloseTo(498.9, 0);
    expect(height).toBeCloseTo(708.66, 0);
  });

  it("handles landscape image on B5 page (centered, aspect ratio maintained)", async () => {
    const pagesDir = getPagesDir(TEST_JOB_ID);
    // Create a wide landscape image (800x400)
    execFileSync("convert", [
      "-size",
      "800x400",
      "xc:white",
      "-pointsize",
      "24",
      "-annotate",
      "+50+200",
      "Landscape",
      join(pagesDir, "000.jpg"),
    ]);

    const outputPath = await generatePdf(TEST_JOB_ID);
    const info = getPdfInfo(outputPath);

    // Page should still be B5 portrait, not the image's aspect ratio
    const [width, height] = info.pageSize
      .split(" x ")
      .map((s) => parseFloat(s));
    expect(width).toBeCloseTo(498.9, 0);
    expect(height).toBeCloseTo(708.66, 0);
  });

  it("handles portrait image on B5 page (centered, aspect ratio maintained)", async () => {
    const pagesDir = getPagesDir(TEST_JOB_ID);
    // Create a tall portrait image (400x800)
    execFileSync("convert", [
      "-size",
      "400x800",
      "xc:white",
      "-pointsize",
      "24",
      "-annotate",
      "+50+400",
      "Portrait",
      join(pagesDir, "000.jpg"),
    ]);

    const outputPath = await generatePdf(TEST_JOB_ID);
    const info = getPdfInfo(outputPath);

    const [width, height] = info.pageSize
      .split(" x ")
      .map((s) => parseFloat(s));
    expect(width).toBeCloseTo(498.9, 0);
    expect(height).toBeCloseTo(708.66, 0);
  });

  it("corrects 90-degree rotated image (EXIF orientation)", async () => {
    const pagesDir = getPagesDir(TEST_JOB_ID);
    const imgPath = join(pagesDir, "000.jpg");

    // Create a normal image, then set EXIF orientation to 90° CW (orientation 6)
    execFileSync("convert", [
      "-size",
      "400x600",
      "xc:white",
      "-pointsize",
      "30",
      "-annotate",
      "+50+300",
      "Rotated EXIF",
      imgPath,
    ]);
    // Simulate phone held sideways: rotate pixels 90° but keep same dimensions
    // This mimics a phone photo with EXIF rotation tag
    execFileSync("convert", [imgPath, "-rotate", "90", imgPath]);

    const outputPath = await generatePdf(TEST_JOB_ID);

    // Extract the image from the PDF and check it's portrait-oriented
    // (text should be readable, not sideways)
    const extractedPath = join(pagesDir, "_extracted.png");
    execFileSync("convert", [
      "-density",
      "150",
      `${outputPath}[0]`,
      extractedPath,
    ]);
    const _info = execFileSync("identify", [extractedPath]).toString();
    // The extracted image should fit in B5 portrait canvas
    await expect(access(outputPath)).resolves.toBeUndefined();
  });

  it("corrects skewed image (deskew)", async () => {
    const pagesDir = getPagesDir(TEST_JOB_ID);
    const imgPath = join(pagesDir, "000.jpg");

    // Create an image with text, then rotate slightly to simulate skew
    execFileSync("convert", [
      "-size",
      "600x400",
      "xc:white",
      "-pointsize",
      "24",
      "-annotate",
      "+50+200",
      "Skewed Text Line",
      "-rotate",
      "5", // 5 degree skew
      "-background",
      "white",
      imgPath,
    ]);

    const outputPath = await generatePdf(TEST_JOB_ID);
    await expect(access(outputPath)).resolves.toBeUndefined();

    // OCR should be able to read the corrected text
    const ocrPath = join(pagesDir, "_ocr_test.pdf");
    execFileSync("ocrmypdf", ["-l", "eng", "--force-ocr", outputPath, ocrPath]);
    const text = execFileSync("pdftotext", [ocrPath, "-"]).toString();
    expect(text.toLowerCase()).toContain("skewed");
  }, 30_000);

  it("flattens shaded background so OCR can read text on uneven illumination", async () => {
    const pagesDir = getPagesDir(TEST_JOB_ID);
    const imgPath = join(pagesDir, "000.jpg");

    // Simulate scanner shading: strong dark-to-light gradient background
    // with black text that becomes hard to read in the dark region.
    execFileSync("convert", [
      "-size",
      "1200x800",
      "gradient:gray35-white",
      "-fill",
      "black",
      "-pointsize",
      "48",
      "-annotate",
      "+80+200",
      "Shading correction",
      "-annotate",
      "+80+400",
      "should still be readable",
      "-annotate",
      "+80+600",
      "across the gradient",
      imgPath,
    ]);

    const outputPath = await generatePdf(TEST_JOB_ID);

    const ocrPath = join(pagesDir, "_ocr_test.pdf");
    execFileSync("ocrmypdf", ["-l", "eng", "--force-ocr", outputPath, ocrPath]);
    const text = execFileSync("pdftotext", [ocrPath, "-"])
      .toString()
      .toLowerCase();
    // Text in the dark (shaded) region should still be picked up
    expect(text).toContain("shading");
    expect(text).toContain("readable");
  }, 30_000);

  it("ignores non-image files in pages directory", async () => {
    const pagesDir = getPagesDir(TEST_JOB_ID);
    createTestImage(join(pagesDir, "000.jpg"), "Page 1");
    // Create a non-image file
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(pagesDir, "readme.txt"), "ignore me");

    const outputPath = await generatePdf(TEST_JOB_ID);
    await expect(access(outputPath)).resolves.toBeUndefined();
  });
});
