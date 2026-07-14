CREATE TABLE `network` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`affiliate_user_id` bigint unsigned NOT NULL,
	`guest_user_id` bigint unsigned NOT NULL,
	`level` enum('1','2','3') NOT NULL,
	`earnings` int NOT NULL DEFAULT 0,
	CONSTRAINT `network_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`actor_type` enum('staff_user','bot_user','system') NOT NULL,
	`actor_id` bigint,
	`action` varchar(100) NOT NULL,
	`entity_type` varchar(100) NOT NULL,
	`entity_id` varchar(255),
	`before` json,
	`after` json,
	`ip_address` varchar(45),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `balance` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`value` decimal(14,2) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`type` enum('sum','subtract') NOT NULL,
	`origin` enum('deposit','withdrawal','earnings','profitability','subscription','tuition','transfer','admin','diamond_tax') NOT NULL,
	`reference_id` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `balance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bot_users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`phone_number` varchar(255) NOT NULL,
	`adress` varchar(255) NOT NULL,
	`pix_code` varchar(255) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`telegram_user_id` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`verified_email_at` timestamp,
	`last_activity` timestamp,
	`deleted_at` timestamp,
	CONSTRAINT `bot_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `bot_users_email_unique` UNIQUE(`email`),
	CONSTRAINT `bot_users_telegram_user_id_unique` UNIQUE(`telegram_user_id`)
);
--> statement-breakpoint
CREATE TABLE `checkouts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`reference_id` varchar(255) NOT NULL,
	`type` enum('deposit','subscription') NOT NULL,
	`value` decimal(14,2) NOT NULL,
	`status` enum('PENDING','AUTHORIZED','PAID','IN_ANALYSIS','DECLINED','CANCELED') NOT NULL DEFAULT 'PENDING',
	`transaction_id` varchar(255),
	`product_id` bigint unsigned,
	`user_id` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `checkouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `verification_email` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`token` varchar(255) NOT NULL,
	`status` enum('pending','expired','checked') NOT NULL DEFAULT 'pending',
	CONSTRAINT `verification_email_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`surname` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`role_id` bigint NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` longtext NOT NULL,
	`price` decimal(14,2) NOT NULL DEFAULT '0.00',
	`earnings_monthly` decimal(5,2) NOT NULL,
	`purchase_type` enum('auto','manual') NOT NULL DEFAULT 'auto',
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_earnings` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`product_id` bigint unsigned NOT NULL,
	`level` enum('1','2','3') NOT NULL,
	`type` enum('subscription','earnings') NOT NULL,
	`percentage` decimal(5,2) NOT NULL,
	CONSTRAINT `product_earnings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users_plans` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`product_id` bigint unsigned NOT NULL,
	`status` int NOT NULL DEFAULT 1,
	`acquired_in` timestamp NOT NULL DEFAULT (now()),
	`expired_in` timestamp NOT NULL,
	CONSTRAINT `users_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `withdrawals` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`value` decimal(14,2) NOT NULL,
	`status` enum('pending','authorized','refused','failed','success') NOT NULL DEFAULT 'pending',
	`reply_observation` longtext,
	`errors_cause` varchar(255),
	`reference_id` varchar(255) NOT NULL,
	`transaction_id` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `withdrawals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `requests` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`type` enum('support','service') NOT NULL,
	`subject` longtext NOT NULL,
	`is_read` int NOT NULL DEFAULT 0,
	`user_id` bigint unsigned NOT NULL,
	`telegram_user_id` bigint NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wallet` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`balance` decimal(14,2) NOT NULL DEFAULT '0.00',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallet_id` PRIMARY KEY(`id`),
	CONSTRAINT `wallet_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `wallet_transactions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`wallet_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`direction` enum('credit','debit') NOT NULL,
	`origin` enum('deposit','withdrawal','earnings','profitability','subscription','tuition','transfer_in','transfer_out','admin_adjustment','diamond_tax') NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`balance_after` decimal(14,2) NOT NULL,
	`reference_type` varchar(50),
	`reference_id` varchar(255),
	`idempotency_key` varchar(255) NOT NULL,
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wallet_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `wallet_transactions_idempotency_key_unique` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `payment_transactions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`provider` enum('asaas') NOT NULL DEFAULT 'asaas',
	`type` enum('deposit','subscription','withdrawal') NOT NULL,
	`external_id` varchar(255),
	`status` enum('pending','processing','confirmed','failed','cancelled','refunded') NOT NULL DEFAULT 'pending',
	`amount` decimal(14,2) NOT NULL,
	`product_id` bigint unsigned,
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_transactions_external_id_unique` UNIQUE(`external_id`)
);
--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`payment_transaction_id` bigint unsigned,
	`provider` enum('asaas') NOT NULL DEFAULT 'asaas',
	`event_type` varchar(100) NOT NULL,
	`external_event_id` varchar(255) NOT NULL,
	`payload` json NOT NULL,
	`processed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_events_external_event_id_unique` UNIQUE(`external_event_id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`provider` enum('asaas') NOT NULL DEFAULT 'asaas',
	`event_type` varchar(100),
	`external_id` varchar(255),
	`headers` json,
	`payload` json NOT NULL,
	`status` enum('received','processing','processed','failed','duplicate') NOT NULL DEFAULT 'received',
	`error` longtext,
	`received_at` timestamp NOT NULL DEFAULT (now()),
	`processed_at` timestamp,
	CONSTRAINT `webhook_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `network` ADD CONSTRAINT `network_affiliate_user_id_bot_users_id_fk` FOREIGN KEY (`affiliate_user_id`) REFERENCES `bot_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network` ADD CONSTRAINT `network_guest_user_id_bot_users_id_fk` FOREIGN KEY (`guest_user_id`) REFERENCES `bot_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `balance` ADD CONSTRAINT `balance_user_id_bot_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `bot_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkouts` ADD CONSTRAINT `checkouts_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkouts` ADD CONSTRAINT `checkouts_user_id_bot_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `bot_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `verification_email` ADD CONSTRAINT `verification_email_user_id_bot_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `bot_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_earnings` ADD CONSTRAINT `product_earnings_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users_plans` ADD CONSTRAINT `users_plans_user_id_bot_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `bot_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users_plans` ADD CONSTRAINT `users_plans_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `withdrawals` ADD CONSTRAINT `withdrawals_user_id_bot_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `bot_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `requests` ADD CONSTRAINT `requests_user_id_bot_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `bot_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wallet` ADD CONSTRAINT `wallet_user_id_bot_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `bot_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wallet_transactions` ADD CONSTRAINT `wallet_transactions_wallet_id_wallet_id_fk` FOREIGN KEY (`wallet_id`) REFERENCES `wallet`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wallet_transactions` ADD CONSTRAINT `wallet_transactions_user_id_bot_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `bot_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_transactions` ADD CONSTRAINT `payment_transactions_user_id_bot_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `bot_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_transactions` ADD CONSTRAINT `payment_transactions_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_events` ADD CONSTRAINT `payment_events_payment_transaction_id_payment_transactions_id_fk` FOREIGN KEY (`payment_transaction_id`) REFERENCES `payment_transactions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `wallet_transactions_user_id_created_at_idx` ON `wallet_transactions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `payment_transactions_user_id_idx` ON `payment_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `webhook_logs_external_id_idx` ON `webhook_logs` (`external_id`);