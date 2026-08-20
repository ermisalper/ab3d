CREATE TABLE `production_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'awaiting_payment' NOT NULL,
	`source_task_id` text NOT NULL,
	`source_task_type` text DEFAULT 'convert' NOT NULL,
	`template_name` text NOT NULL,
	`height_mm` integer NOT NULL,
	`material` text NOT NULL,
	`finish` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`estimated_total_cents` integer NOT NULL,
	`currency` text DEFAULT 'CHF' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_task_id`) REFERENCES `generation_tasks`(`task_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `production_orders_email_created_idx` ON `production_orders` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `production_orders_status_created_idx` ON `production_orders` (`status`,`created_at`);