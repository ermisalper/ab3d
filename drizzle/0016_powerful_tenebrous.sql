CREATE TABLE `ai_usage_admissions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_hash` text NOT NULL,
	`service` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_usage_admissions_account_time_idx` ON `ai_usage_admissions` (`account_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_usage_admissions_time_idx` ON `ai_usage_admissions` (`created_at`);--> statement-breakpoint
-- Change only the non-key balance column. Do not rebuild the referenced accounts
-- table or disable foreign keys: preserve every balance and all child records.
ALTER TABLE `accounts` ADD `_token_balance_no_bonus` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `accounts` SET `_token_balance_no_bonus` = `token_balance`;
--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `token_balance`;
--> statement-breakpoint
ALTER TABLE `accounts` RENAME COLUMN `_token_balance_no_bonus` TO `token_balance`;
