-- Manual preparation only for databases with legacy generation jobs, before
-- applying 0006_bitter_jackpot.sql. Keep generation disabled during this repair.
-- The hosted CAPPATEX table was verified empty before the first 0006 deployment.
-- Preserve one blocking legacy job per account; never make ambiguous calls retryable.
UPDATE `cappatex_designs` SET `status` = 'generation_legacy_review'
WHERE `status` IN ('generating', 'generation_uncertain') AND `id` NOT IN (
  SELECT MIN(`id`) FROM `cappatex_designs` WHERE `status` IN ('generating', 'generation_uncertain') GROUP BY `email`
);
UPDATE `cappatex_designs` SET `status` = 'generation_uncertain' WHERE `status` = 'generating';
