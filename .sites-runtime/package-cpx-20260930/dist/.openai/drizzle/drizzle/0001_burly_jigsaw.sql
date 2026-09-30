CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'inquiry' NOT NULL,
	`customer_name` text NOT NULL,
	`phone` text,
	`street` text NOT NULL,
	`postal_code` text NOT NULL,
	`city` text NOT NULL,
	`country` text DEFAULT 'CH' NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`shipping_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`currency` text DEFAULT 'CHF' NOT NULL,
	`items_json` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `orders_email_created_idx` ON `orders` (`email`,`created_at`);--> statement-breakpoint
