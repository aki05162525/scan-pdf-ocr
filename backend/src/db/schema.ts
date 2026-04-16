import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("uploaded"),
  language: text("language").notNull().default("jpn"),
  pageCount: integer("page_count").notNull().default(0),
  originalPdfPath: text("original_pdf_path"),
  ocrPdfPath: text("ocr_pdf_path"),
  errorMessage: text("error_message"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const jobPages = sqliteTable(
  "job_pages",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    pageOrder: integer("page_order").notNull(),
    imagePath: text("image_path").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index("idx_job_pages_job_id").on(table.jobId)]
);

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type JobPage = typeof jobPages.$inferSelect;
export type NewJobPage = typeof jobPages.$inferInsert;
