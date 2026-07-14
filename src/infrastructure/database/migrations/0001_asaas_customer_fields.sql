ALTER TABLE `bot_users` ADD `cpf` varchar(11);--> statement-breakpoint
ALTER TABLE `bot_users` ADD `asaas_customer_id` varchar(255);--> statement-breakpoint
ALTER TABLE `bot_users` ADD CONSTRAINT `bot_users_asaas_customer_id_unique` UNIQUE(`asaas_customer_id`);