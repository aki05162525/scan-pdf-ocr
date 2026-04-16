# DB設計

## 概要

- DBMS: SQLite
- ORM: Drizzle ORM
- マイグレーション: Drizzle Kit
- IDの生成方式: cuid2（推測不可能な文字列ID）

---

## ER図

```
┌─────────────────────┐       ┌──────────────────────┐
│        jobs          │       │     job_pages         │
├─────────────────────┤       ├──────────────────────┤
│ id (PK)             │──1:N─▶│ id (PK)              │
│ status              │       │ job_id (FK)           │
│ language            │       │ page_order            │
│ page_count          │       │ image_path            │
│ original_pdf_path   │       │ created_at            │
│ ocr_pdf_path        │       └──────────────────────┘
│ error_message       │
│ created_at          │
│ updated_at          │
└─────────────────────┘
```

---

## テーブル定義

### jobs

OCRジョブの管理テーブル。1回のアップロード＋処理 = 1レコード。

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| `id` | TEXT | NO | - | PK。cuid2形式 |
| `status` | TEXT | NO | `'uploaded'` | ジョブの処理状態 |
| `language` | TEXT | NO | `'jpn'` | OCR言語設定 |
| `page_count` | INTEGER | NO | `0` | アップロード画像枚数 |
| `original_pdf_path` | TEXT | YES | `NULL` | 結合PDFの保存パス |
| `ocr_pdf_path` | TEXT | YES | `NULL` | OCR済PDFの保存パス |
| `error_message` | TEXT | YES | `NULL` | 失敗時のエラー内容 |
| `created_at` | TEXT | NO | `datetime('now')` | 作成日時 (ISO 8601) |
| `updated_at` | TEXT | NO | `datetime('now')` | 更新日時 (ISO 8601) |

**status の取りうる値**

| 値 | 説明 |
|----|------|
| `uploaded` | 画像アップロード完了、処理待ち |
| `pdf_generated` | PDF結合完了、OCR待ち |
| `ocr_running` | OCR処理実行中 |
| `completed` | OCR完了、ダウンロード可能 |
| `failed` | 処理失敗 |

---

### job_pages

ジョブに紐づく各ページ（アップロード画像）の管理テーブル。

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|-----|------|-----------|------|
| `id` | TEXT | NO | - | PK。cuid2形式 |
| `job_id` | TEXT | NO | - | FK → jobs.id (ON DELETE CASCADE) |
| `page_order` | INTEGER | NO | - | ページ順序 (0始まり) |
| `image_path` | TEXT | NO | - | 保存先パス |
| `created_at` | TEXT | NO | `datetime('now')` | 作成日時 (ISO 8601) |

**インデックス**

| インデックス名 | カラム | 目的 |
|---------------|--------|------|
| `idx_job_pages_job_id` | `job_id` | ジョブIDでの検索高速化 |

---

## SQL (参考)

```sql
CREATE TABLE jobs (
  id                TEXT PRIMARY KEY,
  status            TEXT NOT NULL DEFAULT 'uploaded',
  language          TEXT NOT NULL DEFAULT 'jpn',
  page_count        INTEGER NOT NULL DEFAULT 0,
  original_pdf_path TEXT,
  ocr_pdf_path      TEXT,
  error_message     TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE job_pages (
  id          TEXT PRIMARY KEY,
  job_id      TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  page_order  INTEGER NOT NULL,
  image_path  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_job_pages_job_id ON job_pages(job_id);
```

---

## Drizzle スキーマ定義 (TypeScript)

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("uploaded"),
  language: text("language").notNull().default("jpn"),
  pageCount: integer("page_count").notNull().default(0),
  originalPdfPath: text("original_pdf_path"),
  ocrPdfPath: text("ocr_pdf_path"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const jobPages = sqliteTable("job_pages", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  pageOrder: integer("page_order").notNull(),
  imagePath: text("image_path").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
```
