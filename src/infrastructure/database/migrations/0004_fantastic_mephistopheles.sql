CREATE INDEX `checkouts_status_created_at_idx` ON `checkouts` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `checkouts_user_id_idx` ON `checkouts` (`user_id`);--> statement-breakpoint
CREATE INDEX `withdrawals_status_created_at_idx` ON `withdrawals` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `withdrawals_user_id_idx` ON `withdrawals` (`user_id`);--> statement-breakpoint
CREATE INDEX `wallet_transactions_origin_created_at_idx` ON `wallet_transactions` (`origin`,`created_at`);--> statement-breakpoint
CREATE INDEX `payment_transactions_status_created_at_idx` ON `payment_transactions` (`status`,`created_at`);