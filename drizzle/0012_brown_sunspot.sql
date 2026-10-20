CREATE TABLE `token_purchase_events` (
	`id` text PRIMARY KEY NOT NULL,
	`body_sha256` text NOT NULL,
	`purchase_id` text NOT NULL,
	`order_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`purchase_id`) REFERENCES `token_purchases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `token_purchase_receipts` (
	`order_key` text PRIMARY KEY NOT NULL,
	`purchase_id` text NOT NULL,
	`event_id` text NOT NULL,
	`credit_nonce` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`purchase_id`) REFERENCES `token_purchases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `token_purchase_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `token_purchase_receipt_once` ON `token_purchase_receipts` (`purchase_id`);--> statement-breakpoint
CREATE TABLE `token_purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`request_id` text NOT NULL,
	`request_sha256` text NOT NULL,
	`pack_id` text NOT NULL,
	`tokens` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`currency` text DEFAULT 'CHF' NOT NULL,
	`country` text NOT NULL,
	`shop_domain` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`snapshot_sha256` text NOT NULL,
	`status` text DEFAULT 'creating_checkout' NOT NULL,
	`cart_id` text,
	`checkout_url` text,
	`order_key` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`email`) REFERENCES `accounts`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `token_purchase_request_once` ON `token_purchases` (`email`,`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `token_purchase_cart_once` ON `token_purchases` (`cart_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `token_purchase_order_once` ON `token_purchases` (`order_key`);--> statement-breakpoint
CREATE INDEX `token_purchase_owner_created` ON `token_purchases` (`email`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `token_ledger_purchase_once` ON `token_ledger` (`task_id`) WHERE "token_ledger"."reason" = 'token_pack_purchase';
--> statement-breakpoint
CREATE UNIQUE INDEX `token_purchase_uncertain_once` ON `token_purchases` (`email`) WHERE "token_purchases"."status" IN ('creating_checkout','checkout_uncertain');
--> statement-breakpoint
CREATE TRIGGER `token_purchase_snapshot_immutable` BEFORE UPDATE ON `token_purchases`
WHEN NEW.id IS NOT OLD.id OR NEW.email IS NOT OLD.email OR NEW.request_id IS NOT OLD.request_id
  OR NEW.request_sha256 IS NOT OLD.request_sha256 OR NEW.pack_id IS NOT OLD.pack_id OR NEW.tokens IS NOT OLD.tokens
  OR NEW.price_cents IS NOT OLD.price_cents OR NEW.currency IS NOT OLD.currency OR NEW.country IS NOT OLD.country
  OR NEW.shop_domain IS NOT OLD.shop_domain OR NEW.snapshot_json IS NOT OLD.snapshot_json
  OR NEW.snapshot_sha256 IS NOT OLD.snapshot_sha256 OR NEW.created_at IS NOT OLD.created_at
  OR (OLD.cart_id IS NOT NULL AND NEW.cart_id IS NOT OLD.cart_id)
  OR (OLD.checkout_url IS NOT NULL AND NEW.checkout_url IS NOT OLD.checkout_url)
  OR (OLD.order_key IS NOT NULL AND NEW.order_key IS NOT OLD.order_key)
BEGIN SELECT RAISE(ABORT, 'immutable_token_purchase'); END;
