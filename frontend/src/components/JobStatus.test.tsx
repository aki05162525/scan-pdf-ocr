import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Job } from "@/lib/api";
import JobStatus from "./JobStatus";

function createJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "test-id",
    status: "uploaded",
    language: "jpn",
    pageCount: 3,
    errorMessage: null,
    hasOcrPdf: false,
    hasOriginalPdf: false,
    createdAt: "2026-04-17T10:00:00Z",
    updatedAt: "2026-04-17T10:00:00Z",
    ...overrides,
  };
}

describe("JobStatus", () => {
  it("displays uploaded status", () => {
    render(<JobStatus job={createJob({ status: "uploaded" })} />);
    expect(screen.getByText("アップロード完了")).toBeInTheDocument();
  });

  it("displays ocr_running status with spinner", () => {
    render(<JobStatus job={createJob({ status: "ocr_running" })} />);
    expect(screen.getByText("OCR処理中...")).toBeInTheDocument();
  });

  it("displays completed status", () => {
    render(<JobStatus job={createJob({ status: "completed" })} />);
    expect(screen.getByText("完了")).toBeInTheDocument();
  });

  it("displays failed status with error message", () => {
    render(
      <JobStatus
        job={createJob({ status: "failed", errorMessage: "OCR engine error" })}
      />,
    );
    expect(screen.getByText("失敗")).toBeInTheDocument();
    expect(screen.getByText("OCR engine error")).toBeInTheDocument();
  });

  it("displays page count", () => {
    render(<JobStatus job={createJob({ pageCount: 5 })} />);
    expect(screen.getByText("5ページ")).toBeInTheDocument();
  });

  it("displays language as Japanese", () => {
    render(<JobStatus job={createJob({ language: "jpn" })} />);
    expect(screen.getByText("日本語")).toBeInTheDocument();
  });

  it("displays language as Japanese + English", () => {
    render(<JobStatus job={createJob({ language: "jpn+eng" })} />);
    expect(screen.getByText("日本語 + 英語")).toBeInTheDocument();
  });

  it("does not show error section when no error", () => {
    render(<JobStatus job={createJob({ status: "completed" })} />);
    expect(screen.queryByText("OCR engine error")).not.toBeInTheDocument();
  });
});
