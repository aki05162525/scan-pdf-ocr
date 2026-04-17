import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { access, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getJobDir, getPagesDir } from "../utils/storage.js";
import { generatePdf } from "./pdf.service.js";
import {
  buildSearchablePdf,
  resolveFontPath,
} from "./searchable-pdf.service.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FONT_PATH = resolve(HERE, "../../fonts/NotoSansCJKjp-Regular.otf");
const hasFont = existsSync(FONT_PATH);

const TEST_JOB_ID = "test-searchable-pdf";

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

function extractText(pdfPath: string): string {
  return execFileSync("pdftotext", [pdfPath, "-"]).toString();
}

function getPageCount(pdfPath: string): number {
  const output = execFileSync("pdfinfo", [pdfPath]).toString();
  const match = output.match(/Pages:\s+(\d+)/);
  if (!match) throw new Error("Could not determine page count");
  return parseInt(match[1], 10);
}

beforeEach(async () => {
  await mkdir(getPagesDir(TEST_JOB_ID), { recursive: true });
});

afterEach(async () => {
  await rm(getJobDir(TEST_JOB_ID), { recursive: true, force: true });
});

describe("resolveFontPath", () => {
  it("returns the project-local font path", () => {
    expect(resolveFontPath()).toMatch(/NotoSansCJKjp-Regular\.otf$/);
  });
});

describe("buildSearchablePdf", () => {
  it.skipIf(!hasFont)(
    "produces a PDF whose extracted text contains the OCR words",
    async () => {
      const pagesDir = getPagesDir(TEST_JOB_ID);
      createTestImage(join(pagesDir, "000.jpg"), "Hello");
      const sourcePdf = await generatePdf(TEST_JOB_ID);
      const outputPath = join(getJobDir(TEST_JOB_ID), "ocr.pdf");

      await buildSearchablePdf({
        sourcePdfPath: sourcePdf,
        outputPath,
        fontPath: FONT_PATH,
        pageOcrResults: [
          {
            imageWidth: 2079,
            imageHeight: 2953,
            words: [
              {
                text: "Hello",
                bbox: { x: 200, y: 800, width: 300, height: 80 },
              },
              {
                text: "World",
                bbox: { x: 520, y: 800, width: 300, height: 80 },
              },
            ],
          },
        ],
      });

      await expect(access(outputPath)).resolves.toBeUndefined();
      const text = extractText(outputPath);
      expect(text).toContain("Hello");
      expect(text).toContain("World");
    },
  );

  it.skipIf(!hasFont)("preserves the source PDF's page count", async () => {
    const pagesDir = getPagesDir(TEST_JOB_ID);
    createTestImage(join(pagesDir, "000.jpg"), "Page 1");
    createTestImage(join(pagesDir, "001.jpg"), "Page 2");
    const sourcePdf = await generatePdf(TEST_JOB_ID);
    const outputPath = join(getJobDir(TEST_JOB_ID), "ocr.pdf");

    await buildSearchablePdf({
      sourcePdfPath: sourcePdf,
      outputPath,
      fontPath: FONT_PATH,
      pageOcrResults: [
        {
          imageWidth: 2079,
          imageHeight: 2953,
          words: [
            { text: "Page1", bbox: { x: 100, y: 200, width: 200, height: 60 } },
          ],
        },
        {
          imageWidth: 2079,
          imageHeight: 2953,
          words: [
            { text: "Page2", bbox: { x: 100, y: 200, width: 200, height: 60 } },
          ],
        },
      ],
    });

    expect(getPageCount(outputPath)).toBe(2);
    const text = extractText(outputPath);
    expect(text).toContain("Page1");
    expect(text).toContain("Page2");
  });

  it.skipIf(!hasFont)("handles Japanese text in the OCR layer", async () => {
    const pagesDir = getPagesDir(TEST_JOB_ID);
    createTestImage(join(pagesDir, "000.jpg"), "JP");
    const sourcePdf = await generatePdf(TEST_JOB_ID);
    const outputPath = join(getJobDir(TEST_JOB_ID), "ocr.pdf");

    await buildSearchablePdf({
      sourcePdfPath: sourcePdf,
      outputPath,
      fontPath: FONT_PATH,
      pageOcrResults: [
        {
          imageWidth: 2079,
          imageHeight: 2953,
          words: [
            {
              text: "日本語",
              bbox: { x: 200, y: 800, width: 300, height: 80 },
            },
          ],
        },
      ],
    });

    const text = extractText(outputPath);
    expect(text).toContain("日本語");
  });

  it.skipIf(!hasFont)(
    "skips pages with no OCR words without failing",
    async () => {
      const pagesDir = getPagesDir(TEST_JOB_ID);
      createTestImage(join(pagesDir, "000.jpg"), "Blank");
      const sourcePdf = await generatePdf(TEST_JOB_ID);
      const outputPath = join(getJobDir(TEST_JOB_ID), "ocr.pdf");

      await buildSearchablePdf({
        sourcePdfPath: sourcePdf,
        outputPath,
        fontPath: FONT_PATH,
        pageOcrResults: [{ imageWidth: 2079, imageHeight: 2953, words: [] }],
      });

      await expect(access(outputPath)).resolves.toBeUndefined();
      expect(getPageCount(outputPath)).toBe(1);
    },
  );
});
