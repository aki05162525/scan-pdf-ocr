import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { access, mkdir, readdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getJobDir, getOcrPdfPath, getPagesDir } from "../utils/storage.js";
import { resolveFontPath } from "./searchable-pdf.service.js";

const FONT_PATH = resolveFontPath();
const hasFont = existsSync(FONT_PATH);

// Mock updateJobStatus so we don't need a real DB
vi.mock("./job.service.js", () => ({
  updateJobStatus: vi.fn(),
}));

// Mock Vision API calls
const mockExtractTextFromImage = vi.fn();
vi.mock("./vision-ocr.service.js", () => ({
  extractTextFromImage: (...args: unknown[]) =>
    mockExtractTextFromImage(...args),
}));

const { updateJobStatus } = await import("./job.service.js");
const { runOcr, processJob } = await import("./ocr.service.js");
const { generatePdf } = await import("./pdf.service.js");

const TEST_JOB_ID = "test-ocr-pipeline";

function createTestImage(filepath: string, text: string) {
  execFileSync("convert", [
    "-size",
    "1200x800",
    "xc:white",
    "-pointsize",
    "48",
    "-annotate",
    "+100+400",
    text,
    filepath,
  ]);
}

beforeEach(async () => {
  vi.clearAllMocks();
  await mkdir(getPagesDir(TEST_JOB_ID), { recursive: true });
});

afterEach(async () => {
  await rm(getJobDir(TEST_JOB_ID), { recursive: true, force: true });
});

describe("runOcr", () => {
  it.skipIf(!hasFont)(
    "calls Vision API per extracted page and writes a searchable PDF",
    async () => {
      const pagesDir = getPagesDir(TEST_JOB_ID);
      createTestImage(join(pagesDir, "000.jpg"), "One");
      createTestImage(join(pagesDir, "001.jpg"), "Two");
      await generatePdf(TEST_JOB_ID);

      mockExtractTextFromImage
        .mockResolvedValueOnce({
          words: [
            { text: "One", bbox: { x: 100, y: 100, width: 200, height: 80 } },
          ],
          imageWidth: 2079,
          imageHeight: 2953,
        })
        .mockResolvedValueOnce({
          words: [
            { text: "Two", bbox: { x: 100, y: 100, width: 200, height: 80 } },
          ],
          imageWidth: 2079,
          imageHeight: 2953,
        });

      await runOcr(TEST_JOB_ID, "eng");

      expect(mockExtractTextFromImage).toHaveBeenCalledTimes(2);
      expect(mockExtractTextFromImage).toHaveBeenCalledWith(
        expect.stringMatching(/\.png$/),
        "eng",
      );

      const ocrPath = getOcrPdfPath(TEST_JOB_ID);
      await expect(access(ocrPath)).resolves.toBeUndefined();

      const text = execFileSync("pdftotext", [ocrPath, "-"]).toString();
      expect(text).toContain("One");
      expect(text).toContain("Two");
    },
    60_000,
  );

  it.skipIf(!hasFont)(
    "transitions status ocr_running → completed on success",
    async () => {
      const pagesDir = getPagesDir(TEST_JOB_ID);
      createTestImage(join(pagesDir, "000.jpg"), "Hi");
      await generatePdf(TEST_JOB_ID);

      mockExtractTextFromImage.mockResolvedValue({
        words: [
          { text: "Hi", bbox: { x: 100, y: 100, width: 100, height: 80 } },
        ],
        imageWidth: 2079,
        imageHeight: 2953,
      });

      await runOcr(TEST_JOB_ID, "eng");

      expect(updateJobStatus).toHaveBeenCalledWith(TEST_JOB_ID, "ocr_running");
      expect(updateJobStatus).toHaveBeenCalledWith(TEST_JOB_ID, "completed", {
        ocrPdfPath: getOcrPdfPath(TEST_JOB_ID),
      });
    },
    30_000,
  );

  it("sets failed status when source PDF is missing", async () => {
    await expect(runOcr(TEST_JOB_ID, "eng")).rejects.toThrow();
    expect(updateJobStatus).toHaveBeenCalledWith(TEST_JOB_ID, "ocr_running");
    expect(updateJobStatus).toHaveBeenCalledWith(
      TEST_JOB_ID,
      "failed",
      expect.objectContaining({ errorMessage: expect.any(String) }),
    );
  });

  it("processes extracted PNGs in numeric page order", async () => {
    const pagesDir = getPagesDir(TEST_JOB_ID);
    for (let i = 0; i < 10; i++) {
      createTestImage(join(pagesDir, `${i.toString().padStart(3, "0")}.jpg`), `${i + 1}`);
    }
    await generatePdf(TEST_JOB_ID);

    const seenFiles: string[] = [];
    mockExtractTextFromImage.mockImplementation(async (imagePath: string) => {
      seenFiles.push(basename(imagePath));
      return { words: [], imageWidth: 2079, imageHeight: 2953 };
    });

    await runOcr(TEST_JOB_ID, "eng");

    expect(seenFiles).toEqual([
      "_ocr_extract-1.png",
      "_ocr_extract-2.png",
      "_ocr_extract-3.png",
      "_ocr_extract-4.png",
      "_ocr_extract-5.png",
      "_ocr_extract-6.png",
      "_ocr_extract-7.png",
      "_ocr_extract-8.png",
      "_ocr_extract-9.png",
      "_ocr_extract-10.png",
    ]);
  }, 60_000);

  it.skipIf(!hasFont)(
    "cleans up intermediate extracted PNGs after OCR",
    async () => {
      const pagesDir = getPagesDir(TEST_JOB_ID);
      createTestImage(join(pagesDir, "000.jpg"), "Cleanup");
      await generatePdf(TEST_JOB_ID);

      mockExtractTextFromImage.mockResolvedValue({
        words: [],
        imageWidth: 2079,
        imageHeight: 2953,
      });

      await runOcr(TEST_JOB_ID, "eng");

      const files = await readdir(pagesDir);
      const leftover = files.filter((f) => f.startsWith("_ocr_extract"));
      expect(leftover).toEqual([]);
    },
    30_000,
  );

  it("cleans up intermediate extracted PNGs when OCR fails", async () => {
    const pagesDir = getPagesDir(TEST_JOB_ID);
    createTestImage(join(pagesDir, "000.jpg"), "Cleanup on failure");
    await generatePdf(TEST_JOB_ID);

    mockExtractTextFromImage.mockRejectedValue(new Error("vision failed"));

    await expect(runOcr(TEST_JOB_ID, "eng")).rejects.toThrow("vision failed");

    const files = await readdir(pagesDir);
    const leftover = files.filter((f) => f.startsWith("_ocr_extract"));
    expect(leftover).toEqual([]);
  }, 30_000);
});

describe("processJob", () => {
  it.skipIf(!hasFont)(
    "runs generatePdf then runOcr end-to-end",
    async () => {
      const pagesDir = getPagesDir(TEST_JOB_ID);
      createTestImage(join(pagesDir, "000.jpg"), "Pipeline");

      mockExtractTextFromImage.mockResolvedValue({
        words: [
          {
            text: "Pipeline",
            bbox: { x: 100, y: 100, width: 400, height: 80 },
          },
        ],
        imageWidth: 2079,
        imageHeight: 2953,
      });

      await processJob(TEST_JOB_ID, "eng");

      expect(updateJobStatus).toHaveBeenCalledWith(
        TEST_JOB_ID,
        "pdf_generated",
        expect.objectContaining({ originalPdfPath: expect.any(String) }),
      );
      expect(updateJobStatus).toHaveBeenCalledWith(TEST_JOB_ID, "completed", {
        ocrPdfPath: getOcrPdfPath(TEST_JOB_ID),
      });
    },
    60_000,
  );

  it("sets failed status when generatePdf fails (no images)", async () => {
    await processJob(TEST_JOB_ID, "eng");
    expect(updateJobStatus).toHaveBeenCalledWith(
      TEST_JOB_ID,
      "failed",
      expect.objectContaining({ errorMessage: expect.any(String) }),
    );
  });
});
