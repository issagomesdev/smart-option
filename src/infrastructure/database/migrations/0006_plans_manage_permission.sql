-- Migration escrita à mão (carrega dado, não estrutura — mesmo caso do seed de papéis em
-- `0003_tan_carmella_unuscione.sql`): a nova chave `plans.manage` do catálogo
-- (`src/shared/permissions/permissions.ts`) precisa chegar ao papel `admin` já semeado, senão
-- ninguém consegue administrar planos num banco existente sem editar JSON na mão.
--
-- `JSON_CONTAINS` no WHERE torna a migration idempotente e segura de reaplicar.
UPDATE `roles`
SET `permissions` = JSON_ARRAY_APPEND(`permissions`, '$', 'plans.manage')
WHERE `id` = 1 AND NOT JSON_CONTAINS(`permissions`, '"plans.manage"');
