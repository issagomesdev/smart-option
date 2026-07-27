ALTER TABLE `products` ADD `is_system` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `is_active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Backfill (editado à mão): sem isto, um banco já existente ficaria com os 6 planos semeados
-- marcados como não-sistema e portanto excluíveis pelo novo CRUD — e apagar os IDs 3/4 quebra a
-- promoção/rebaixamento de tier em `src/server/cron.ts:141-143`. Os IDs são fixos por contrato
-- (ver `src/infrastructure/database/seeds/plans.seed.ts`), o mesmo contrato que o cron já assume.
UPDATE `products` SET `is_system` = true WHERE `id` IN (1, 2, 3, 4, 5, 6);