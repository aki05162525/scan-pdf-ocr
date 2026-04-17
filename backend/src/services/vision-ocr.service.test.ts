import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDocumentTextDetection = vi.fn();

vi.mock("@google-cloud/vision", () => ({
  default: {
    ImageAnnotatorClient: function MockImageAnnotatorClient() {
      return { documentTextDetection: mockDocumentTextDetection };
    },
  },
}));

const { extractTextFromImage, toBcp47Language, toBcp47LanguageHints } = await import(
  "./vision-ocr.service.js"
);

function makeVisionResponse(opts: {
  width: number;
  height: number;
  words: Array<{
    text: string;
    vertices: [number, number, number, number, number, number, number, number];
  }>;
}) {
  return [
    {
      fullTextAnnotation: opts.words.length
        ? {
            text: opts.words.map((w) => w.text).join(" "),
            pages: [
              {
                width: opts.width,
                height: opts.height,
                blocks: [
                  {
                    blockType: "TEXT",
                    paragraphs: [
                      {
                        words: opts.words.map((w) => ({
                          symbols: [],
                          boundingBox: {
                            vertices: [
                              { x: w.vertices[0], y: w.vertices[1] },
                              { x: w.vertices[2], y: w.vertices[3] },
                              { x: w.vertices[4], y: w.vertices[5] },
                              { x: w.vertices[6], y: w.vertices[7] },
                            ],
                          },
                          // Words have a text property derived from symbols; we
                          // simulate by attaching a convenience field the
                          // service is expected to reconstruct
                        })),
                      },
                    ],
                  },
                ],
              },
            ],
          }
        : null,
    },
  ];
}

// Helper: mock Vision client so each "word" returned carries its own text,
// because the real API returns words as a list of symbols, not a text string.
function makeVisionResponseWithSymbols(opts: {
  width: number;
  height: number;
  words: Array<{
    text: string;
    bbox: [number, number, number, number]; // x1,y1,x2,y2 (axis-aligned)
  }>;
}) {
  return [
    {
      fullTextAnnotation: opts.words.length
        ? {
            text: opts.words.map((w) => w.text).join(" "),
            pages: [
              {
                width: opts.width,
                height: opts.height,
                blocks: [
                  {
                    blockType: "TEXT",
                    paragraphs: [
                      {
                        words: opts.words.map((w) => ({
                          symbols: Array.from(w.text).map((ch) => ({
                            text: ch,
                          })),
                          boundingBox: {
                            vertices: [
                              { x: w.bbox[0], y: w.bbox[1] },
                              { x: w.bbox[2], y: w.bbox[1] },
                              { x: w.bbox[2], y: w.bbox[3] },
                              { x: w.bbox[0], y: w.bbox[3] },
                            ],
                          },
                        })),
                      },
                    ],
                  },
                ],
              },
            ],
          }
        : null,
    },
  ];
}

beforeEach(() => {
  mockDocumentTextDetection.mockReset();
});

describe("extractTextFromImage", () => {
  it("returns normalized words with axis-aligned bboxes", async () => {
    mockDocumentTextDetection.mockResolvedValue(
      makeVisionResponseWithSymbols({
        width: 2079,
        height: 2953,
        words: [
          { text: "Hello", bbox: [100, 200, 300, 260] },
          { text: "World", bbox: [320, 200, 520, 260] },
        ],
      }),
    );

    const result = await extractTextFromImage("/tmp/fake.png", "eng");

    expect(result.imageWidth).toBe(2079);
    expect(result.imageHeight).toBe(2953);
    expect(result.words).toEqual([
      {
        text: "Hello",
        bbox: { x: 100, y: 200, width: 200, height: 60 },
      },
      {
        text: "World",
        bbox: { x: 320, y: 200, width: 200, height: 60 },
      },
    ]);
  });

  it("returns empty words for a blank page (no fullTextAnnotation)", async () => {
    mockDocumentTextDetection.mockResolvedValue([{ fullTextAnnotation: null }]);

    const result = await extractTextFromImage("/tmp/blank.png", "eng");

    expect(result.words).toEqual([]);
    expect(result.imageWidth).toBe(0);
    expect(result.imageHeight).toBe(0);
  });

  it("passes language hint in BCP-47 form to Vision API", async () => {
    mockDocumentTextDetection.mockResolvedValue(
      makeVisionResponseWithSymbols({ width: 100, height: 100, words: [] }),
    );

    await extractTextFromImage("/tmp/fake.png", "jpn");

    expect(mockDocumentTextDetection).toHaveBeenCalledWith(
      expect.objectContaining({
        image: { source: { filename: "/tmp/fake.png" } },
        imageContext: { languageHints: ["ja"] },
      }),
    );
  });

  it("passes composite language hints in BCP-47 form to Vision API", async () => {
    mockDocumentTextDetection.mockResolvedValue(
      makeVisionResponseWithSymbols({ width: 100, height: 100, words: [] }),
    );

    await extractTextFromImage("/tmp/fake.png", "jpn+eng");

    expect(mockDocumentTextDetection).toHaveBeenCalledWith(
      expect.objectContaining({
        image: { source: { filename: "/tmp/fake.png" } },
        imageContext: { languageHints: ["ja", "en"] },
      }),
    );
  });

  it("reads image from local file path", async () => {
    mockDocumentTextDetection.mockResolvedValue(
      makeVisionResponseWithSymbols({ width: 100, height: 100, words: [] }),
    );

    await extractTextFromImage("/tmp/fake.png", "eng");

    expect(mockDocumentTextDetection).toHaveBeenCalledWith(
      expect.objectContaining({
        image: { source: { filename: "/tmp/fake.png" } },
      }),
    );
  });

  it("merges symbols within a word into the word's text", async () => {
    mockDocumentTextDetection.mockResolvedValue(
      makeVisionResponseWithSymbols({
        width: 100,
        height: 100,
        words: [{ text: "ABC", bbox: [0, 0, 30, 20] }],
      }),
    );

    const result = await extractTextFromImage("/tmp/fake.png", "eng");

    expect(result.words[0].text).toBe("ABC");
  });
});

describe("toBcp47Language", () => {
  it("maps jpn to ja", () => {
    expect(toBcp47Language("jpn")).toBe("ja");
  });
  it("maps eng to en", () => {
    expect(toBcp47Language("eng")).toBe("en");
  });
  it("passes through already-BCP-47 codes", () => {
    expect(toBcp47Language("ja")).toBe("ja");
    expect(toBcp47Language("en")).toBe("en");
  });
});

describe("toBcp47LanguageHints", () => {
  it("splits composite OCR languages into BCP-47 hints", () => {
    expect(toBcp47LanguageHints("jpn+eng")).toEqual(["ja", "en"]);
  });
});

// Keep helper reference so TS doesn't complain about unused fn
void makeVisionResponse;
