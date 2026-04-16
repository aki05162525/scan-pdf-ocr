import { z } from "zod/v4";

export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png"];
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_PAGE_COUNT = 50;

export const languageSchema = z.enum(["jpn", "jpn+eng"]);

export const createJobSchema = z.object({
  language: languageSchema.default("jpn"),
  pageOrder: z
    .string()
    .transform((val) => JSON.parse(val) as number[])
    .optional(),
});

export const listJobsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
