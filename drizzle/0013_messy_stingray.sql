CREATE TABLE `production_review_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`version` integer NOT NULL,
	`state` text NOT NULL,
	`actor_email` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `production_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_review_event_version` ON `production_review_events` (`order_id`,`version`);--> statement-breakpoint
CREATE TABLE `production_reviews` (
	`order_id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'new' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`version` integer NOT NULL,
	`write_nonce` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `production_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `production_reviews_state_idx` ON `production_reviews` (`state`);--> statement-breakpoint
ALTER TABLE `production_orders` ADD `request_details_json` text;