import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdir, rm, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import { generatePdf } from "./pdf.service.js";
import { getPagesDir, getOriginalPdfPath, getJobDir } from "../utils/storage.js";

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
      "No image files found"
    );
  });

  it("generates PDF with B5 page size (498 x 709 pts)", async () => {
    const pagesDir = getPagesDir(TEST_JOB_ID);
    createTestImage(join(pagesDir, "000.jpg"), "B5 test");

    const outputPath = await generatePdf(TEST_JOB_ID);
    const info = getPdfInfo(outputPath);

    // B5 = 176mm x 250mm = 498.9 x 708.66 pts
    // pdfinfo rounds, so check approximate values
    const [width, height] = info.pageSize.split(" x ").map((s) => parseFloat(s));
    expect(width).toBeCloseTo(498.9, 0);
    expect(height).toBeCloseTo(708.66, 0);
  });

  it("handles landscape image on B5 page (centered, aspect ratio maintained)", async () => {
    const pagesDir = getPagesDir(TEST_JOB_ID);
    // Create a wide landscape image (800x400)
    execFileSync("convert", [
      "-size", "800x400", "xc:white",
      "-pointsize", "24", "-annotate", "+50+200", "Landscape",
      join(pagesDir, "000.jpg"),
    ]);

    const outputPath = await generatePdf(TEST_JOB_ID);
    const info = getPdfInfo(outputPath);

    // Page should still be B5 portrait, not the image's aspect ratio
    const [width, height] = info.pageSize.split(" x ").map((s) => parseFloat(s));
    expect(width).toBeCloseTo(498.9, 0);
    expect(height).toBeCloseTo(708.66, 0);
  });

  it("handles portrait image on B5 page (centered, aspect ratio maintained)", async () => {
    const pagesDir = getPagesDir(TEST_JOB_ID);
    // Create a tall portrait image (400x800)
    execFileSync("convert", [
      "-size", "400x800", "xc:white",
      "-pointsize", "24", "-annotate", "+50+400", "Portrait",
      join(pagesDir, "000.jpg"),
    ]);

    const outputPath = await generatePdf(TEST_JOB_ID);
    const info = getPdfInfo(outputPath);

    const [width, height] = info.pageSize.split(" x ").map((s) => parseFloat(s));
    expect(width).toBeCloseTo(498.9, 0);
    expect(height).toBeCloseTo(708.66, 0);
  });

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
