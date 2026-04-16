"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Job } from "@/lib/api";
import { deleteJob, getOcrPdfUrl, listJobs } from "@/lib/api";

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  uploaded: { label: "処理待ち", color: "bg-gray-100 text-gray-700" },
  pdf_generated: { label: "PDF生成済", color: "bg-blue-100 text-blue-700" },
  ocr_running: { label: "OCR中", color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "完了", color: "bg-green-100 text-green-700" },
  failed: { label: "失敗", color: "bg-red-100 text-red-700" },
};

export default function JobHistoryTable() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const data = await listJobs(page, limit);
      setJobs(data.jobs);
      setTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleDelete = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    if (!confirm("このジョブを削除しますか？")) return;
    await deleteJob(jobId);
    fetchJobs();
  };

  const totalPages = Math.ceil(total / limit);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">読み込み中...</div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        処理履歴がありません
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-3 px-4">作成日時</th>
              <th className="py-3 px-4">ページ数</th>
              <th className="py-3 px-4">言語</th>
              <th className="py-3 px-4">ステータス</th>
              <th className="py-3 px-4">操作</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const badge = STATUS_BADGE[job.status] ?? {
                label: job.status,
                color: "bg-gray-100",
              };
              return (
                <tr
                  key={job.id}
                  onClick={() => router.push(`/jobs/${job.id}`)}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                >
                  <td className="py-3 px-4">
                    {new Date(job.createdAt).toLocaleString("ja-JP")}
                  </td>
                  <td className="py-3 px-4">{job.pageCount}</td>
                  <td className="py-3 px-4">
                    {job.language === "jpn" ? "日本語" : "日本語+英語"}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      {job.hasOcrPdf && (
                        <a
                          href={getOcrPdfUrl(job.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:underline"
                        >
                          DL
                        </a>
                      )}
                      <button
                        onClick={(e) => handleDelete(e, job.id)}
                        className="text-red-600 hover:underline"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            前へ
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}
