CREATE TABLE `cappatex_designs` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`prompt` text NOT NULL,
	`production_prompt` text NOT NULL,
	`style` text NOT NULL,
	`product_key` text NOT NULL,
	`preview_base64` text NOT NULL,
	`preview_format` text DEFAULT 'webp' NOT NULL,
	`printify_product_id` text,
	`printify_variant_id` integer,
	`printify_blueprint_id` integer,
	`printify_provider_id` integer,
	`shopify_variant_id` text,
	`shopify_cart_id` text,
	`shopify_order_id` text,
	`printify_order_id` text,
	`placement_json` text,
	`status` text DEFAULT 'preview_ready' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cappatex_designs_email_created_idx` ON `cappatex_designs` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `cappatex_designs_shopify_order_idx` ON `cappatex_designs` (`shopify_order_id`);--> statement-breakpoint
CREATE TABLE `cappatex_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`topic` text NOT NULL,
	`received_at` integer NOT NULL
);
