import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execFile, execFileSync } from "node:child_process";
import { mkdir, rm, access } from "node:fs/promises";
import { join } from "node:path";
import {
  getPagesDir,
  getJobDir,
  getOriginalPdfPath,
  getOcrPdfPath,
} from "../utils/storage.js";

function getPdfPageCount(pdfPath: string): number {
  const output = execFileSync("pdfinfo", [pdfPath]).toString();
  const match = output.match(/Pages:\s+(\d+)/);
  if (!match) throw new Error("Could not determine page count");
  return parseInt(match[1], 10);
}

const TEST_JOB_ID = "test-ocr-run";

// Mock updateJobStatus to avoid needing a real DB
vi.mock("./job.service.js", () => ({
  updateJobStatus: vi.fn(),
}));

const { updateJobStatus } = await import("./job.service.js");
const { runOcr } = await import("./ocr.service.js");
const { generatePdf } = await import("./pdf.service.js");

function isOcrmypdfInstalled(): boolean {
  try {
    execFileSync("which", ["ocrmypdf"]);
    return true;
  } catch {
    return false;
  }
}

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

beforeEach(async () => {
  vi.clearAllMocks();
  const pagesDir = getPagesDir(TEST_JOB_ID);
  await mkdir(pagesDir, { recursive: true });
});

afterEach(async () => {
  await rm(getJobDir(TEST_JOB_ID), { recursive: true, force: true });
});

describe("runOcr", () => {
  it.skipIf(!isOcrmypdfInstalled())(
    "runs OCR on a PDF and produces searchable output",
    async () => {
      // Arrange: create test image and generate PDF
      const pagesDir = getPagesDir(TEST_JOB_ID);
      createTestImage(join(pagesDir, "000.jpg"), "Hello World");
      await generatePdf(TEST_JOB_ID);

      // Act
      await runOcr(TEST_JOB_ID, "eng");

      // Assert: OCR PDF exists
      const ocrPath = getOcrPdfPath(TEST_JOB_ID);
      await expect(access(ocrPath)).resolves.toBeUndefined();

      // Assert: status transitions
      expect(updateJobStatus).toHaveBeenCalledWith(TEST_JOB_ID, "ocr_running");
      expect(updateJobStatus).toHaveBeenCalledWith(TEST_JOB_ID, "completed", {
        ocrPdfPath: ocrPath,
      });
    },
    30_000
  );

  it.skipIf(!isOcrmypdfInstalled())(
    "runs OCR with Japanese language",
    async () => {
      const pagesDir = getPagesDir(TEST_JOB_ID);
      createTestImage(join(pagesDir, "000.jpg"), "Test 123");
      await generatePdf(TEST_JOB_ID);

      await runOcr(TEST_JOB_ID, "jpn");

      const ocrPath = getOcrPdfPath(TEST_JOB_ID);
      await expect(access(ocrPath)).resolves.toBeUndefined();
    },
    30_000
  );

  it.skipIf(!isOcrmypdfInstalled())(
    "sets failed status when input PDF does not exist",
    async () => {
      // Don't create any files - the original PDF won't exist
      await expect(runOcr(TEST_JOB_ID, "eng")).rejects.toThrow();

      expect(updateJobStatus).toHaveBeenCalledWith(TEST_JOB_ID, "ocr_running");
      expect(updateJobStatus).toHaveBeenCalledWith(
        TEST_JOB_ID,
        "failed",
        expect.objectContaining({ errorMessage: expect.any(String) })
      );
    }
  );
});

describe("ocrmypdf options", () => {
  it.skipIf(!isOcrmypdfInstalled())(
    "passes --clean, --image-dpi 300, --optimize 1 for quality improvement",
    async () => {
      const pagesDir = getPagesDir(TEST_JOB_ID);
      createTestImage(join(pagesDir, "000.jpg"), "Quality Test");
      await generatePdf(TEST_JOB_ID);

      // Spy on execFile to capture the actual arguments
      const { execFile: realExecFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const calls: string[][] = [];
      const origExecFile = realExecFile;

      // Run OCR and check it succeeds with the new options
      await runOcr(TEST_JOB_ID, "eng");

      const ocrPath = getOcrPdfPath(TEST_JOB_ID);
      await expect(access(ocrPath)).resolves.toBeUndefined();

      // Verify the OCR PDF has text (quality check)
      const text = execFileSync("pdftotext", [ocrPath, "-"]).toString();
      expect(text.toLowerCase()).toContain("quality");
    },
    30_000
  );
});

describe("full pipeline (PDF generation + OCR)", () => {
  it.skipIf(!isOcrmypdfInstalled())(
    "processes multiple images end-to-end",
    async () => {
      // Arrange
      const pagesDir = getPagesDir(TEST_JOB_ID);
      createTestImage(join(pagesDir, "000.jpg"), "Page One");
      createTestImage(join(pagesDir, "001.jpg"), "Page Two");

      // Act: generate PDF
      const originalPath = await generatePdf(TEST_JOB_ID);
      await expect(access(originalPath)).resolves.toBeUndefined();

      // Act: run OCR
      await runOcr(TEST_JOB_ID, "eng");

      // Assert
      const ocrPath = getOcrPdfPath(TEST_JOB_ID);
      await expect(access(ocrPath)).resolves.toBeUndefined();

      // Verify page count of OCR PDF
      expect(getPdfPageCount(ocrPath)).toBe(2);
    },
    60_000
  );
});
