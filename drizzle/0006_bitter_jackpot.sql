ALTER TABLE `cappatex_designs` ADD `token_reserved` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cappatex_designs` ADD `token_refunded` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Preserve one blocking legacy job per account; never treat ambiguous old calls as retryable.
UPDATE `cappatex_designs` SET `status` = 'generation_legacy_review'
WHERE `status` IN ('generating', 'generation_uncertain') AND `id` NOT IN (
  SELECT MIN(`id`) FROM `cappatex_designs` WHERE `status` IN ('generating', 'generation_uncertain') GROUP BY `email`
);--> statement-breakpoint
UPDATE `cappatex_designs` SET `status` = 'generation_uncertain' WHERE `status` = 'generating';--> statement-breakpoint
CREATE UNIQUE INDEX `cappatex_one_generation_per_email` ON `cappatex_designs` (`email`) WHERE "cappatex_designs"."status" IN ('generating', 'generation_uncertain');
