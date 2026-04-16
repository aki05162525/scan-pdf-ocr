import { describe, it, expect } from "vitest";
import {
  languageSchema,
  createJobSchema,
  listJobsSchema,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  MAX_TOTAL_SIZE,
  MAX_PAGE_COUNT,
} from "./job.validator.js";

describe("languageSchema", () => {
  it("accepts 'jpn'", () => {
    expect(languageSchema.parse("jpn")).toBe("jpn");
  });

  it("accepts 'jpn+eng'", () => {
    expect(languageSchema.parse("jpn+eng")).toBe("jpn+eng");
  });

  it("rejects invalid language", () => {
    expect(() => languageSchema.parse("eng")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => languageSchema.parse("")).toThrow();
  });
});

describe("createJobSchema", () => {
  it("parses with default language", () => {
    const result = createJobSchema.parse({});
    expect(result.language).toBe("jpn");
    expect(result.pageOrder).toBeUndefined();
  });

  it("parses with explicit language", () => {
    const result = createJobSchema.parse({ language: "jpn+eng" });
    expect(result.language).toBe("jpn+eng");
  });

  it("parses pageOrder from JSON string", () => {
    const result = createJobSchema.parse({ pageOrder: "[2,0,1]" });
    expect(result.pageOrder).toEqual([2, 0, 1]);
  });

  it("rejects invalid language", () => {
    expect(() => createJobSchema.parse({ language: "fra" })).toThrow();
  });
});

describe("listJobsSchema", () => {
  it("applies defaults", () => {
    const result = listJobsSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("coerces string numbers", () => {
    const result = listJobsSchema.parse({ page: "3", limit: "10" });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
  });

  it("rejects page < 1", () => {
    expect(() => listJobsSchema.parse({ page: "0" })).toThrow();
  });

  it("rejects limit > 100", () => {
    expect(() => listJobsSchema.parse({ limit: "101" })).toThrow();
  });
});

describe("constants", () => {
  it("has correct allowed extensions", () => {
    expect(ALLOWED_EXTENSIONS).toEqual([".jpg", ".jpeg", ".png"]);
  });

  it("has 20MB file size limit", () => {
    expect(MAX_FILE_SIZE).toBe(20 * 1024 * 1024);
  });

  it("has 100MB total size limit", () => {
    expect(MAX_TOTAL_SIZE).toBe(100 * 1024 * 1024);
  });

  it("has 50 page limit", () => {
    expect(MAX_PAGE_COUNT).toBe(50);
  });
});
