"use client";

import type { Job } from "@/lib/api";

interface Props {
  job: Job;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  uploaded: { label: "アップロード完了", color: "bg-gray-100 text-gray-700" },
  pdf_generated: { label: "PDF生成完了", color: "bg-blue-100 text-blue-700" },
  ocr_running: {
    label: "OCR処理中...",
    color: "bg-yellow-100 text-yellow-700",
  },
  completed: { label: "完了", color: "bg-green-100 text-green-700" },
  failed: { label: "失敗", color: "bg-red-100 text-red-700" },
};

export default function JobStatus({ job }: Props) {
  const status = STATUS_MAP[job.status] ?? {
    label: job.status,
    color: "bg-gray-100",
  };
  const isProcessing = ["uploaded", "pdf_generated", "ocr_running"].includes(
    job.status,
  );

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center gap-3 mb-4">
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}
        >
          {status.label}
        </span>
        {isProcessing && (
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-gray-500">ページ数</dt>
          <dd className="font-medium">{job.pageCount}ページ</dd>
        </div>
        <div>
          <dt className="text-gray-500">OCR言語</dt>
          <dd className="font-medium">
            {job.language === "jpn" ? "日本語" : "日本語 + 英語"}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">開始日時</dt>
          <dd className="font-medium">
            {new Date(job.createdAt).toLocaleString("ja-JP")}
          </dd>
        </div>
      </dl>

      {job.status === "failed" && job.errorMessage && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {job.errorMessage}
        </div>
      )}
    </div>
  );
}
