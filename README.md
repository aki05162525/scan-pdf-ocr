# Scan to Searchable PDF

画像からOCR済みの検索可能なPDFを生成するWebアプリ。

## 必要なもの

- Node.js 20+
- Google Cloud Platform アカウント（Vision API を使用）
- 画像処理ツール（Ubuntu/Debian）

```bash
sudo apt-get install -y imagemagick ghostscript poppler-utils
```

## セットアップ

### 1. GCP Vision API の認証情報を取得

1. GCP コンソールで Cloud Vision API を有効化
2. サービスアカウントを作成し、JSON キーをダウンロード
3. 安全な場所に配置（例: `~/.config/gcp/vision-key.json`）

### 2. backend

```bash
cd backend
npm install
cp .env.example .env
# .env を編集して GOOGLE_APPLICATION_CREDENTIALS にキーの絶対パスを指定
./scripts/download-font.sh   # PDF 透明テキスト層用の日本語フォントを取得
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 3. frontend

```bash
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
| OCR | Google Cloud Vision API |
| PDF生成 | ImageMagick + pdf-lib（透明テキスト層） |
| テスト | Vitest, React Testing Library |
