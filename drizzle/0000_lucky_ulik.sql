CREATE TABLE `accounts` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`token_balance` integer DEFAULT 2 NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`subscription_status` text DEFAULT 'inactive' NOT NULL,
	`requested_plan` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `generation_tasks` (
	`task_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`kind` text NOT NULL,
	`token_cost` integer NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`refunded` integer DEFAULT false NOT NULL,
	`parent_task_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `generation_tasks_email_idx` ON `generation_tasks` (`email`);--> statement-breakpoint
CREATE TABLE `subscription_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`plan` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `subscription_requests_email_idx` ON `subscription_requests` (`email`);--> statement-breakpoint
CREATE TABLE `token_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`task_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `token_ledger_email_idx` ON `token_ledger` (`email`);