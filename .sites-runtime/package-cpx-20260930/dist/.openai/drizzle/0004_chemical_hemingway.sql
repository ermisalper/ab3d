CREATE TABLE `checkout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_email` text,
	`shopify_cart_id` text NOT NULL,
	`channel` text NOT NULL,
	`status` text DEFAULT 'checkout_created' NOT NULL,
	`items_json` text NOT NULL,
	`estimated_total_cents` integer NOT NULL,
	`currency` text DEFAULT 'CHF' NOT NULL,
	`legal_version` text NOT NULL,
	`shopify_order_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checkout_sessions_shopify_cart_id_unique` ON `checkout_sessions` (`shopify_cart_id`);--> statement-breakpoint
CREATE INDEX `checkout_sessions_email_created_idx` ON `checkout_sessions` (`account_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `checkout_sessions_status_created_idx` ON `checkout_sessions` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `shopify_orders` (
	`order_id` text PRIMARY KEY NOT NULL,
	`order_name` text,
	`customer_email` text,
	`customer_name` text NOT NULL,
	`phone` text,
	`address1` text NOT NULL,
	`address2` text,
	`postal_code` text NOT NULL,
	`city` text NOT NULL,
	`region` text,
	`country` text NOT NULL,
	`financial_status` text NOT NULL,
	`fulfillment_status` text,
	`channel` text NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`shipping_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`items_json` text NOT NULL,
	`legal_version` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shopify_orders_email_created_idx` ON `shopify_orders` (`customer_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `shopify_orders_status_created_idx` ON `shopify_orders` (`financial_status`,`created_at`);