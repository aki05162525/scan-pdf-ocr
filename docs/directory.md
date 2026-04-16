# ディレクトリ構成

## 全体構成

```
scan-pdf-ocr/
├── frontend/                     # Next.js (App Router)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              # トップ/アップロード画面
│   │   │   ├── jobs/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx      # 処理中 & 結果画面
│   │   │   └── history/
│   │   │       └── page.tsx          # 履歴一覧画面
│   │   ├── components/
│   │   │   ├── ImageUploader.tsx      # D&D + ファイル選択
│   │   │   ├── ImagePreviewList.tsx   # プレビュー + 並び替え + 削除
│   │   │   ├── LanguageSelect.tsx     # OCR言語選択
│   │   │   ├── JobStatus.tsx          # ステータス表示 + ポーリング
│   │   │   ├── JobResult.tsx          # 結果表示 + DLボタン
│   │   │   └── JobHistoryTable.tsx    # 履歴テーブル
│   │   └── lib/
│   │       └── api.ts                # バックエンドAPI呼び出し
│   ├── public/
│   ├── package.json
│   ├── next.config.ts
│   └── tsconfig.json
│
├── backend/                      # Hono + Node.js
│   ├── src/
│   │   ├── index.ts                  # Honoアプリ起動 + ルート登録
│   │   ├── routes/
│   │   │   └── jobs.ts               # /api/jobs ルーティング
│   │   ├── services/
│   │   │   ├── job.service.ts        # ジョブCRUDロジック
│   │   │   ├── pdf.service.ts        # 画像→PDF結合
│   │   │   └── ocr.service.ts        # ocrmypdf呼び出し (child_process)
│   │   ├── db/
│   │   │   ├── schema.ts            # Drizzle スキーマ定義
│   │   │   ├── index.ts             # DB接続 (SQLite)
│   │   │   └── migrations/          # Drizzle マイグレーションファイル
│   │   ├── validators/
│   │   │   └── job.validator.ts     # Zod バリデーション
│   │   └── utils/
│   │       ├── storage.ts           # ファイル保存・取得・削除
│   │       └── logger.ts            # ログ出力
│   ├── storage/                     # アップロードファイル保存先 (.gitignore対象)
│   │   └── jobs/
│   │       └── {id}/
│   │           ├── pages/           # 元画像
│   │           │   ├── 000.jpg
│   │           │   └── 001.png
│   │           ├── original.pdf     # 結合PDF
│   │           └── ocr.pdf          # OCR済PDF
│   ├── drizzle.config.ts
│   ├── package.json
│   └── tsconfig.json
│
├── docs/                         # 設計ドキュメント
│   ├── screens.md                # 画面一覧
│   ├── api.md                    # API設計
│   ├── database.md               # DB設計
│   └── directory.md              # ディレクトリ構成 (本ファイル)
│
├── memo.md                       # 要件定義
└── .gitignore
```

---

## 各ディレクトリの役割

### frontend/

Next.js App Router によるフロントエンドアプリケーション。

| ディレクトリ | 役割 |
|-------------|------|
| `src/app/` | ページコンポーネント (App Router) |
| `src/components/` | 再利用可能なUIコンポーネント |
| `src/lib/` | API呼び出し等のユーティリティ |

### backend/

Hono + Node.js によるバックエンドAPI。

| ディレクトリ | 役割 |
|-------------|------|
| `src/routes/` | Honoルーティング定義（薄く保つ） |
| `src/services/` | ビジネスロジック（ジョブ管理、PDF結合、OCR実行） |
| `src/db/` | Drizzle ORMスキーマ・DB接続・マイグレーション |
| `src/validators/` | Zodによるリクエストバリデーション |
| `src/utils/` | ファイル操作・ログ等の共通ユーティリティ |
| `storage/` | アップロードファイル・生成PDF の保存先 |

---

## ストレージ構造

```
storage/jobs/{id}/
├── pages/           # アップロードされた元画像
│   ├── 000.jpg      # page_order=0 の画像
│   ├── 001.png      # page_order=1 の画像
│   └── ...
├── original.pdf     # 画像を結合したPDF
└── ocr.pdf          # OCR処理済みPDF
```

### 設計方針

- **ジョブIDごとにディレクトリを分離**: 削除時は `rm -rf storage/jobs/{id}` で完結
- **ファイル名はサーバー側で再採番**: `000`, `001`... → パストラバーサル対策
- **IDには cuid2 を使用**: 推測不可能な文字列ID
- **storage/ は .gitignore 対象**: 実データをリポジトリに含めない
