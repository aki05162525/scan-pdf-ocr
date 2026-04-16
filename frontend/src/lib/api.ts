const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export interface Job {
  id: string;
  status: "uploaded" | "pdf_generated" | "ocr_running" | "completed" | "failed";
  language: string;
  pageCount: number;
  errorMessage: string | null;
  hasOcrPdf: boolean;
  hasOriginalPdf: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JobListResponse {
  jobs: Job[];
  total: number;
  page: number;
  limit: number;
}

export async function createJob(
  images: File[],
  language: string,
  pageOrder?: number[],
): Promise<Job> {
  const formData = new FormData();
  for (const image of images) {
    formData.append("images", image);
  }
  formData.append("language", language);
  if (pageOrder) {
    formData.append("pageOrder", JSON.stringify(pageOrder));
  }

  const res = await fetch(`${API_BASE}/jobs`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error ?? "Failed to create job");
  }

  return res.json();
}

export async function getJob(id: string): Promise<Job> {
  const res = await fetch(`${API_BASE}/jobs/${id}`);
  if (!res.ok) throw new Error("Job not found");
  return res.json();
}

export async function listJobs(page = 1, limit = 20): Promise<JobListResponse> {
  const res = await fetch(`${API_BASE}/jobs?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch jobs");
  return res.json();
}

export async function deleteJob(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete job");
}

export function getOcrPdfUrl(id: string): string {
  return `${API_BASE}/jobs/${id}/files/ocr-pdf`;
}

export function getOriginalPdfUrl(id: string): string {
  return `${API_BASE}/jobs/${id}/files/original-pdf`;
}
