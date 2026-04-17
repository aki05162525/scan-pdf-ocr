import vision from "@google-cloud/vision";

export interface WordBox {
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface VisionOcrResult {
  words: WordBox[];
  imageWidth: number;
  imageHeight: number;
}

// Tesseract-style 3-letter codes → BCP-47 (what Vision API expects as a hint).
// We keep the public API taking tesseract codes for backward compatibility with
// the existing Job.language column.
const LANGUAGE_MAP: Record<string, string> = {
  jpn: "ja",
  eng: "en",
};

export function toBcp47Language(code: string): string {
  return LANGUAGE_MAP[code] ?? code;
}

export function toBcp47LanguageHints(code: string): string[] {
  return code
    .split("+")
    .map((part) => toBcp47Language(part))
    .filter((part, index, parts) => part.length > 0 && parts.indexOf(part) === index);
}

let cachedClient: InstanceType<typeof vision.ImageAnnotatorClient> | null =
  null;

function getClient() {
  if (!cachedClient) {
    cachedClient = new vision.ImageAnnotatorClient();
  }
  return cachedClient;
}

export async function extractTextFromImage(
  imagePath: string,
  language: string,
): Promise<VisionOcrResult> {
  const client = getClient();

  const [response] = await client.documentTextDetection({
    image: { source: { filename: imagePath } },
    imageContext: { languageHints: toBcp47LanguageHints(language) },
  });

  const annotation = response.fullTextAnnotation;
  if (!annotation?.pages || annotation.pages.length === 0) {
    return { words: [], imageWidth: 0, imageHeight: 0 };
  }

  const page = annotation.pages[0];
  const words: WordBox[] = [];

  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const word of paragraph.words ?? []) {
        const text = (word.symbols ?? []).map((s) => s.text ?? "").join("");
        if (!text) continue;

        const vertices = word.boundingBox?.vertices ?? [];
        if (vertices.length === 0) continue;

        const xs = vertices.map((v) => v.x ?? 0);
        const ys = vertices.map((v) => v.y ?? 0);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        words.push({
          text,
          bbox: {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          },
        });
      }
    }
  }

  return {
    words,
    imageWidth: page.width ?? 0,
    imageHeight: page.height ?? 0,
  };
}
