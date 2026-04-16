"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ImagePreviewList from "@/components/ImagePreviewList";
import ImageUploader from "@/components/ImageUploader";
import LanguageSelect from "@/components/LanguageSelect";
import { createJob } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [language, setLanguage] = useState("jpn");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFilesAdded = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleReorder = (reordered: File[]) => {
    setFiles(reordered);
  };

  const handleRemove = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      const job = await createJob(files, language);
      router.push(`/jobs/${job.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setSubmitting(false);
    }
  };

  return (
    <main className="flex-1">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Scan to Searchable PDF</h1>
          <a href="/history" className="text-sm text-blue-600 hover:underline">
            履歴一覧
          </a>
        </div>

        <ImageUploader
          onFilesAdded={handleFilesAdded}
          currentCount={files.length}
        />
        <ImagePreviewList
          files={files}
          onReorder={handleReorder}
          onRemove={handleRemove}
        />

        {files.length > 0 && (
          <div className="mt-6 flex items-end gap-4">
            <LanguageSelect value={language} onChange={setLanguage} />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {submitting ? "送信中..." : "OCR実行"}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
