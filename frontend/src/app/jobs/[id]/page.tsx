"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { getJob } from "@/lib/api";
import type { Job } from "@/lib/api";
import JobStatus from "@/components/JobStatus";
import JobResult from "@/components/JobResult";

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const data = await getJob(id);
        if (!active) return;
        setJob(data);

        // Continue polling if still processing
        if (["uploaded", "pdf_generated", "ocr_running"].includes(data.status)) {
          setTimeout(poll, 2000);
        }
      } catch {
        if (active) setError("ジョブの取得に失敗しました");
      }
    };

    poll();
    return () => {
      active = false;
    };
  }, [id]);

  if (error) {
    return (
      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">{error}</div>
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-4 py-8 text-center text-gray-500">
          読み込み中...
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">ジョブ詳細</h1>
          <a href="/history" className="text-sm text-blue-600 hover:underline">
            履歴一覧
          </a>
        </div>

        <JobStatus job={job} />

        {job.status === "completed" && <JobResult job={job} />}
      </div>
    </main>
  );
}
