CREATE TABLE `staff_refresh_tokens` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`staff_user_id` bigint unsigned NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`revoked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_refresh_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_refresh_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `staff_refresh_tokens` ADD CONSTRAINT `staff_refresh_tokens_staff_user_id_users_id_fk` FOREIGN KEY (`staff_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `staff_refresh_tokens_staff_user_id_idx` ON `staff_refresh_tokens` (`staff_user_id`);