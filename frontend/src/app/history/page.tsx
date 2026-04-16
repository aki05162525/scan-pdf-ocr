"use client";

import JobHistoryTable from "@/components/JobHistoryTable";

export default function HistoryPage() {
  return (
    <main className="flex-1">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">処理履歴</h1>
          <a href="/" className="text-sm text-blue-600 hover:underline">
            新規作成
          </a>
        </div>

        <div className="bg-white rounded-lg border">
          <JobHistoryTable />
        </div>
      </div>
    </main>
  );
}
