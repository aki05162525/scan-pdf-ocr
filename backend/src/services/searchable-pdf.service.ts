import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";

export interface PageOcrResult {
  words: Array<{
    text: string;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
  imageWidth: number;
  imageHeight: number;
}

export interface BuildSearchablePdfParams {
  sourcePdfPath: string;
  outputPath: string;
  pageOcrResults: PageOcrResult[];
  fontPath: string;
}

export function resolveFontPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../fonts/NotoSansCJKjp-Regular.otf");
}

export async function buildSearchablePdf(
  params: BuildSearchablePdfParams,
): Promise<void> {
  const { sourcePdfPath, outputPath, pageOcrResults, fontPath } = params;

  const sourceBytes = await readFile(sourcePdfPath);
  const pdfDoc = await PDFDocument.load(sourceBytes);
  const pages = pdfDoc.getPages();

  // Subsetting a CFF-based OTF (Noto CJK) with zero glyphs crashes fontkit, so
  // only embed the font when at least one page actually needs a text layer.
  const hasAnyWords = pageOcrResults.some((r) => r.words.length > 0);
  let font: Awaited<ReturnType<typeof pdfDoc.embedFont>> | undefined;
  if (hasAnyWords) {
    pdfDoc.registerFontkit(fontkit);
    const fontBytes = await readFile(fontPath);
    font = await pdfDoc.embedFont(fontBytes, { subset: true });
  }

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const ocr = pageOcrResults[i];
    if (!ocr || ocr.words.length === 0 || !font) continue;

    const { width: pageWidth, height: pageHeight } = page.getSize();
    // Vision API reports bbox in source image pixel coords. The source image
    // was embedded into this PDF page filling the full page canvas, so we can
    // derive a uniform scale from the ratio of page-points to image-pixels.
    const scaleX = pageWidth / ocr.imageWidth;
    const scaleY = pageHeight / ocr.imageHeight;

    for (const word of ocr.words) {
      const fontSize = Math.max(1, word.bbox.height * scaleY * 0.85);
      // Vision API: origin top-left, y grows down. PDF: origin bottom-left,
      // y grows up. Flip y using the word's bottom edge so the text baseline
      // sits near the bottom of the original bbox.
      const pdfX = word.bbox.x * scaleX;
      const pdfY = pageHeight - (word.bbox.y + word.bbox.height) * scaleY;

      page.drawText(word.text, {
        x: pdfX,
        y: pdfY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
        opacity: 0,
      });
    }
  }

  const finalBytes = await pdfDoc.save();
  await writeFile(outputPath, finalBytes);
}
