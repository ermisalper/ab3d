CREATE TABLE `gallery_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`studio` text NOT NULL,
	`source_id` text,
	`source_type` text,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`consent_version` text,
	`consent_at` integer,
	`public_requested` integer DEFAULT 0 NOT NULL,
	`rights_confirmed` integer DEFAULT 0 NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`state` text DEFAULT 'creating' NOT NULL,
	`result_task_id` text,
	`thumbnail_key` text,
	`thumbnail_type` text,
	`asset_key` text,
	`asset_bytes` integer,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gallery_source_unique` ON `gallery_entries` (`studio`,`source_id`);--> statement-breakpoint
CREATE INDEX `gallery_owner_created` ON `gallery_entries` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `gallery_public_category` ON `gallery_entries` (`visibility`,`studio`,`category`,`created_at`);--> statement-breakpoint
CREATE TABLE `gallery_task_links` (
	`task_id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`task_type` text NOT NULL,
	`role` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`asset_key` text,
	`asset_bytes` integer,
	`thumbnail_key` text,
	`thumbnail_type` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `generation_tasks`(`task_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entry_id`) REFERENCES `gallery_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `gallery_tasks_entry` ON `gallery_task_links` (`entry_id`);