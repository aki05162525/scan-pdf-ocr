# CORE PRINCIPLES

* Follow Kent Beck's Test-Driven Development (TDD) methodology as the preferred approach for all development work.
* Document at the right layer: Code → How, Tests → What, Commits → Why, Comments → Why not
* Keep documentation up to date with code changes

# PROJECT OVERVIEW

画像からOCR済み検索可能PDFを生成するWebアプリ（Scan to Searchable PDF）。

# TECH STACK

* **frontend**: Next.js 16 (App Router) + Tailwind CSS — `frontend/`
* **backend**: Hono + Node.js — `backend/`
* **DB**: SQLite + Drizzle ORM
* **OCR**: OCRmyPDF + Tesseract (child_process経由)。`backend/tessdata/` があれば `TESSDATA_PREFIX` で参照され、`tessdata_best` の高精度モデルが使われる
* **PDF生成**: ImageMagick (convert)
* **テスト**: Vitest, React Testing Library

# COMMANDS

```bash
# backend (port 3001)
cd backend && npm run dev        # 開発サーバー
cd backend && npm test           # テスト実行
cd backend && npm run test:watch # テストウォッチ
cd backend && npx drizzle-kit generate  # マイグレーション生成
cd backend && npx drizzle-kit migrate   # マイグレーション適用
cd backend && ./scripts/download-tessdata.sh  # tessdata_best (高精度LSTMモデル) をDL

# frontend (port 3000)
cd frontend && npm run dev       # 開発サーバー
cd frontend && npm test          # テスト実行
cd frontend && npm run test:watch # テストウォッチ
```

# CODE CONVENTIONS

* コミットメッセージ: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`)
* バリデーション: Zod (`backend/src/validators/`)
* DBスキーマ変更時は必ず `drizzle-kit generate` → `drizzle-kit migrate`
* OCR処理は非同期ジョブとして実行（HTTPリクエスト内で同期実行しない）
* ファイル名はサーバー側で再採番（000, 001...）、ユーザー入力のファイル名を直接使わない
* IDは cuid2 を使用

# ARCHITECTURE

* `backend/src/routes/` — Honoルーティング（薄く保つ）
* `backend/src/services/` — ビジネスロジック
* `backend/src/db/` — Drizzleスキーマ・DB接続
* `backend/src/validators/` — Zodバリデーション
* `backend/src/utils/` — ファイル操作・ログ
* `frontend/src/app/` — Next.js App Routerページ
* `frontend/src/components/` — UIコンポーネント
* `frontend/src/lib/` — API呼び出し関数
* `docs/` — 設計ドキュメント（画面・API・DB・ディレクトリ構成）
