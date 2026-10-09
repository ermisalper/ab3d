CREATE TABLE `cappatex_fulfillment_lines` (
	`snapshot_id` text PRIMARY KEY NOT NULL,
	`fulfillment_id` text NOT NULL,
	`shopify_line_id` text NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `cappatex_snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fulfillment_id`) REFERENCES `cappatex_fulfillments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cappatex_fulfillments` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text NOT NULL,
	`input_sha256` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`request_sha256` text,
	`printify_order_id` text,
	`error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cappatex_fulfillments_external_id_unique` ON `cappatex_fulfillments` (`external_id`);--> statement-breakpoint
CREATE TABLE `cappatex_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`design_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`payload_sha256` text NOT NULL,
	`cart_id` text,
	`state` text DEFAULT 'prepared' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`design_id`) REFERENCES `cappatex_designs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `cappatex_designs` ADD `artwork_key` text;--> statement-breakpoint
ALTER TABLE `cappatex_designs` ADD `artwork_sha256` text;--> statement-breakpoint
ALTER TABLE `cappatex_designs` ADD `artwork_width` integer;--> statement-breakpoint
ALTER TABLE `cappatex_designs` ADD `artwork_height` integer;