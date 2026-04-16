"use client";

import type { Job } from "@/lib/api";
import { getOcrPdfUrl, getOriginalPdfUrl, deleteJob } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  job: Job;
}

export default function JobResult({ job }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("このジョブを削除しますか？関連ファイルもすべて削除されます。")) return;
    setDeleting(true);
    try {
      await deleteJob(job.id);
      router.push("/history");
    } catch {
      alert("削除に失敗しました");
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-3 mt-6">
      {job.hasOcrPdf && (
        <a
          href={getOcrPdfUrl(job.id)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          OCR済PDFをダウンロード
        </a>
      )}
      {job.hasOriginalPdf && (
        <a
          href={getOriginalPdfUrl(job.id)}
          className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
        >
          元PDFをダウンロード
        </a>
      )}
      <button
        onClick={() => router.push("/")}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium"
      >
        新規作成
      </button>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium disabled:opacity-50"
      >
        {deleting ? "削除中..." : "削除"}
      </button>
    </div>
  );
}
