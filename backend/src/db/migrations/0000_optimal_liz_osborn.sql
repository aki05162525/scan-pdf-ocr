CREATE TABLE `job_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`page_order` integer NOT NULL,
	`image_path` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_job_pages_job_id` ON `job_pages` (`job_id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'uploaded' NOT NULL,
	`language` text DEFAULT 'jpn' NOT NULL,
	`page_count` integer DEFAULT 0 NOT NULL,
	`original_pdf_path` text,
	`ocr_pdf_path` text,
	`error_message` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
