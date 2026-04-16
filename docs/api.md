# API設計

## 概要

- ベースパス: `/api`
- フレームワーク: Hono (Node.js)
- データ形式: JSON（ファイルアップロードは `multipart/form-data`、ダウンロードはバイナリ）

---

## エンドポイント一覧

| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| `POST` | `/api/jobs` | ジョブ作成（画像アップロード＋OCR開始） |
| `GET` | `/api/jobs` | 履歴一覧取得 |
| `GET` | `/api/jobs/:id` | ジョブ詳細取得（ポーリング用） |
| `GET` | `/api/jobs/:id/files/ocr-pdf` | OCR済PDFダウンロード |
| `GET` | `/api/jobs/:id/files/original-pdf` | 元PDFダウンロード |
| `DELETE` | `/api/jobs/:id` | ジョブ削除（ファイル含む） |

---

## 詳細

### POST /api/jobs

ジョブを作成し、バックグラウンドでPDF結合 → OCR処理を開始する。

**Request**

```
Content-Type: multipart/form-data

Fields:
  images:    File[]   # 複数画像ファイル (jpg/jpeg/png)
  language:  string   # "jpn" | "jpn+eng"
  pageOrder: string   # JSON配列 例: "[2,0,1]" (ファイルの並び順インデックス)
```

**Response `201 Created`**

```json
{
  "id": "clx1a2b3c4d5e6f7g8h9i0j",
  "status": "uploaded",
  "language": "jpn",
  "pageCount": 3,
  "errorMessage": null,
  "hasOcrPdf": false,
  "hasOriginalPdf": false,
  "createdAt": "2026-04-17T10:00:00Z",
  "updatedAt": "2026-04-17T10:00:00Z"
}
```

**エラーレスポンス**

| ステータス | 条件 |
|-----------|------|
| `400` | バリデーションエラー（非対応拡張子、サイズ超過、ページ数超過、language不正） |
| `413` | リクエストボディが総容量制限を超過 |

---

### GET /api/jobs

履歴一覧を取得する。

**Query Parameters**

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `page` | number | 1 | ページ番号 |
| `limit` | number | 20 | 1ページあたりの件数 (最大100) |

**Response `200 OK`**

```json
{
  "jobs": [
    {
      "id": "clx1a2b3c4d5e6f7g8h9i0j",
      "status": "completed",
      "language": "jpn",
      "pageCount": 3,
      "errorMessage": null,
      "hasOcrPdf": true,
      "hasOriginalPdf": true,
      "createdAt": "2026-04-17T10:00:00Z",
      "updatedAt": "2026-04-17T10:02:30Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

---

### GET /api/jobs/:id

ジョブの詳細を取得する。フロントからのポーリングに使用。

**Response `200 OK`**

```json
{
  "id": "clx1a2b3c4d5e6f7g8h9i0j",
  "status": "completed",
  "language": "jpn",
  "pageCount": 3,
  "errorMessage": null,
  "hasOcrPdf": true,
  "hasOriginalPdf": true,
  "createdAt": "2026-04-17T10:00:00Z",
  "updatedAt": "2026-04-17T10:02:30Z"
}
```

**ステータス値**

| status | 説明 |
|--------|------|
| `uploaded` | 画像アップロード完了、処理待ち |
| `pdf_generated` | PDF結合完了、OCR待ち |
| `ocr_running` | OCR処理実行中 |
| `completed` | OCR完了、ダウンロード可能 |
| `failed` | 処理失敗 |

**エラーレスポンス**

| ステータス | 条件 |
|-----------|------|
| `404` | 指定IDのジョブが存在しない |

---

### GET /api/jobs/:id/files/ocr-pdf

OCR済みPDFをダウンロードする。

**Response `200 OK`**

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="scan_2026-04-17_ocr.pdf"
```

**エラーレスポンス**

| ステータス | 条件 |
|-----------|------|
| `404` | ジョブが存在しない、またはOCR済PDFが未生成 |

---

### GET /api/jobs/:id/files/original-pdf

結合した元PDFをダウンロードする。

**Response `200 OK`**

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="scan_2026-04-17_original.pdf"
```

**エラーレスポンス**

| ステータス | 条件 |
|-----------|------|
| `404` | ジョブが存在しない、または元PDFが未生成 |

---

### DELETE /api/jobs/:id

ジョブとそれに紐づくすべてのファイルを削除する。

**Response `204 No Content`**

（ボディなし）

**エラーレスポンス**

| ステータス | 条件 |
|-----------|------|
| `404` | 指定IDのジョブが存在しない |

---

## バリデーションルール

| 項目 | 制約 |
|------|------|
| 対応拡張子 | `.jpg`, `.jpeg`, `.png` |
| 1ファイル最大サイズ | 20MB |
| アップロード総容量 | 100MB |
| 最大ページ数 | 50枚 |
| language | `jpn` または `jpn+eng` のみ |

---

## 処理フロー

```
1. POST /api/jobs
   → 画像保存 → job レコード作成 (status: uploaded)
   → バックグラウンドで以下を開始:

2. PDF結合 (pdf.service.ts)
   → pages/*.jpg を pageOrder 順に結合 → original.pdf
   → status: pdf_generated

3. OCR実行 (ocr.service.ts)
   → child_process.exec("ocrmypdf --language jpn ...")
   → status: ocr_running → completed (or failed)

4. フロントは GET /api/jobs/:id を 2秒間隔でポーリング
   → completed になったらDLボタン表示
```
