CREATE TABLE `cappatex_preparations` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`request_id` text NOT NULL,
	`request_sha256` text NOT NULL,
	`state` text DEFAULT 'preparing' NOT NULL,
	`payload_json` text,
	`payload_sha256` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cappatex_preparation_request` ON `cappatex_preparations` (`email`,`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cappatex_preparation_in_progress` ON `cappatex_preparations` (`email`) WHERE "cappatex_preparations"."state" = 'preparing';--> statement-breakpoint
CREATE INDEX `cappatex_preparation_owner_created` ON `cappatex_preparations` (`email`,`created_at`);