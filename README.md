# Scan to Searchable PDF

画像からOCR済みの検索可能なPDFを生成するWebアプリ。

## 必要なもの

- Node.js 20+
- OCR関連ツール（Ubuntu/Debian）

```bash
sudo apt-get install -y ocrmypdf tesseract-ocr tesseract-ocr-jpn imagemagick ghostscript poppler-utils
```

## セットアップ

```bash
# backend
cd backend
npm install
npx drizzle-kit generate
npx drizzle-kit migrate

# frontend
cd frontend
npm install
```

## 起動

```bash
# backend (port 3001)
cd backend && npm run dev

# frontend (port 3000)
cd frontend && npm run dev
```

http://localhost:3000 にアクセス。

## テスト

```bash
cd backend && npm test
cd frontend && npm test
```

## 使い方

1. トップページで画像（JPG/PNG）をドラッグ&ドロップ
2. ページ順をドラッグで並び替え
3. OCR言語を選択（日本語 / 日本語+英語）
4. 「OCR実行」をクリック
5. 処理完了後、OCR済みPDFをダウンロード

## 技術スタック

| 領域 | 技術 |
|------|------|
| frontend | Next.js (App Router), Tailwind CSS |
| backend | Hono, Node.js |
| DB | SQLite, Drizzle ORM |
| OCR | OCRmyPDF, Tesseract |
| PDF生成 | ImageMagick |
| テスト | Vitest, React Testing Library |
