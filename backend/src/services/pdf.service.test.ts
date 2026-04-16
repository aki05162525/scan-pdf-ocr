import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdir, rm, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import { generatePdf } from "./pdf.service.js";
import { getPagesDir, getOriginalPdfPath, getJobDir } from "../utils/storage.js";

function getPdfPageCount(pdfPath: string): number {
  const output = execFileSync("pdfinfo", [pdfPath]).toString();
  const match = output.match(/Pages:\s+(\d+)/);
  if (!match) throw new Error("Could not determine page count");
  return parseInt(match[1], 10);
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
    expect(getPdfPageCount(outputPath)).toBe(3);
  });

  it("throws when no images exist", async () => {
    await expect(generatePdf(TEST_JOB_ID)).rejects.toThrow(
      "No image files found"
    );
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
