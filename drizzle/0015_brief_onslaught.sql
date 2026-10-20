ALTER TABLE `production_orders` ADD `inquiry_request_id` text;--> statement-breakpoint
ALTER TABLE `production_orders` ADD `inquiry_request_sha256` text;--> statement-breakpoint
CREATE UNIQUE INDEX `production_orders_inquiry_request` ON `production_orders` (`email`,`inquiry_request_id`) WHERE "production_orders"."inquiry_request_id" IS NOT NULL;