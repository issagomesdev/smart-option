-- Fase 5 (parte 3) do painel admin: introduz o RBAC. Única migration deste
-- projeto que também carrega dados, por necessidade: a linha do staff já
-- semeado (`users.id=1`) tem `role_id=1` desde sempre, e o `ALTER TABLE...ADD
-- CONSTRAINT` abaixo falharia com erro 1452 (violação de FK) se `roles`
-- estivesse vazia no momento em que rodar — os 2 papéis semente precisam
-- existir ANTES da constraint ser adicionada, não depois (e não em
-- `scripts/seed.ts`, que só roda depois das migrations).
CREATE TABLE `roles` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` varchar(255),
	`permissions` json NOT NULL DEFAULT ('[]'),
	`is_system` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
-- `id` explícito: 1 (`admin`) precisa bater com o `role_id=1` que o staff já
-- semeado (`scripts/seed.ts`) sempre teve; 2 (`staff`) vira o novo default da
-- coluna (ver ALTER abaixo) para qualquer staff futuro, sem privilégio nenhum
-- até um `staff.manage` reatribuir o papel dele.
INSERT INTO `roles` (`id`, `name`, `description`, `permissions`, `is_system`) VALUES
	(1, 'admin', 'Acesso total — todas as permissões do sistema.', '["users.write","finance.adjust","withdrawals.approve","support.write","staff.manage","roles.manage"]', true),
	(2, 'staff', 'Papel padrão para staff novo — só leitura até um admin conceder permissões.', '[]', true);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role_id` bigint unsigned NOT NULL DEFAULT 2;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE no action ON UPDATE no action;