"use client";

import { useCallback, useRef } from "react";
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_MB,
  MAX_PAGE_COUNT,
} from "./constants";

interface Props {
  onFilesAdded: (files: File[]) => void;
  currentCount: number;
}

export default function ImageUploader({ onFilesAdded, currentCount }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndAdd = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const files = Array.from(fileList);
      const valid: File[] = [];
      const errors: string[] = [];

      for (const file of files) {
        const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          errors.push(`${file.name}: 非対応の形式です`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          errors.push(`${file.name}: ${MAX_FILE_SIZE_MB}MBを超えています`);
          continue;
        }
        valid.push(file);
      }

      if (currentCount + valid.length > MAX_PAGE_COUNT) {
        alert(`最大${MAX_PAGE_COUNT}ページまでです`);
        return;
      }

      if (errors.length > 0) {
        alert(errors.join("\n"));
      }

      if (valid.length > 0) {
        onFilesAdded(valid);
      }
    },
    [onFilesAdded, currentCount],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      validateAndAdd(e.dataTransfer.files);
    },
    [validateAndAdd],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const openFileDialog = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png"
        onChange={(e) => validateAndAdd(e.target.files)}
        className="hidden"
      />
      <button
        type="button"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={openFileDialog}
        aria-label="ファイルをアップロード"
        className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
      >
        <span className="block text-lg text-gray-600">
          ここに画像をドラッグ&ドロップ
        </span>
        <span className="block text-sm text-gray-400 mt-2">
          またはクリックしてファイルを選択
        </span>
        <span className="block text-xs text-gray-400 mt-1">
          JPG / PNG / 1ファイル{MAX_FILE_SIZE_MB}MBまで / 最大{MAX_PAGE_COUNT}
          ページ
        </span>
      </button>
    </>
  );
}
