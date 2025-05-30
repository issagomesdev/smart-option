-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Tempo de geração: 26-Maio-2025 às 21:00
-- Versão do servidor: 5.7.39
-- versão do PHP: 8.3.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

--
-- Banco de dados: `smartoption`
--

-- --------------------------------------------------------

--
-- Estrutura da tabela `balance`
--

CREATE TABLE `balance` (
  `id` bigint(20) NOT NULL,
  `value` decimal(10,2) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `type` enum('sum','subtract') NOT NULL,
  `origin` enum('deposit','withdrawal','earnings','profitability','subscription','tuition','transfer','admin','diamond_tax') NOT NULL,
  `reference_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estrutura da tabela `bot_users`
--

CREATE TABLE `bot_users` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `phone_number` varchar(255) NOT NULL,
  `adress` varchar(255) NOT NULL,
  `pix_code` varchar(255) NOT NULL,
  `is_active` int(11) NOT NULL DEFAULT '1',
  `telegram_user_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verified_email_at` timestamp NULL DEFAULT NULL,
  `last_activity` timestamp NULL DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estrutura da tabela `checkouts`
--

CREATE TABLE `checkouts` (
  `id` bigint(20) NOT NULL,
  `reference_id` varchar(255) NOT NULL,
  `type` enum('deposit','subscription') NOT NULL,
  `value` decimal(10,2) NOT NULL,
  `status` enum('PENDING','AUTHORIZED','PAID','IN_ANALYSIS','DECLINED','CANCELED') NOT NULL DEFAULT 'PENDING',
  `transaction_id` varchar(255) DEFAULT NULL,
  `product_id` bigint(20) DEFAULT NULL,
  `user_id` bigint(20) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estrutura da tabela `network`
--

CREATE TABLE `network` (
  `id` bigint(20) NOT NULL,
  `affiliate_user_id` bigint(20) NOT NULL,
  `guest_user_id` bigint(20) NOT NULL,
  `level` enum('1','2','3') NOT NULL,
  `earnings` int(11) NOT NULL DEFAULT '0'
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estrutura da tabela `products`
--

CREATE TABLE `products` (
  `id` bigint(20) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` longtext NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `earnings_monthly` decimal(5,2) NOT NULL,
  `purchase_type` enum('auto','manual') NOT NULL DEFAULT 'auto'
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

--
-- Extraindo dados da tabela `products`
--

INSERT INTO `products` (`id`, `name`, `description`, `price`, `earnings_monthly`, `purchase_type`) VALUES
(1, 'bronze', '  🥉Smart Bronze (até 4% ao mês) – R$ 97,00\n\n  Bônus de ADESÃO (Ilimitado)\n  ╔═════════╗\n  ║ Nível 1- 30% \n  ║ Nível 2- 7%     ╠ 40% 💵\n  ║ Nível 3- 3%  \n  ╚═════════╝\n  \n  Bônus de RENTABILIDADE (até 3 afiliados por nível)\n  ╔═════════════════╗\n  ║ Nível 1- (2,33% * 3) = 7%  \n  ║ Nível 2- (1,66% * 3) = 5%     ╠ 15% 💵\n  ║ Nível 3- (1,00% * 3) = 3%   \n  ╚═════════════════╝', 97.00, 4.00, 'auto'),
(2, 'silver', '  🥈Smart Silver (até 6% ao mês) – R$ 197,00\r\n\r\n  Bônus de ADESÃO (Ilimitado)\r\n  ╔═════════╗\r\n  ║ Nível 1- 33%  \r\n  ║ Nível 2- 8%     ╠ 45% 💵\r\n  ║ Nível 3- 4% \r\n  ╚═════════╝\r\n  \r\n  Bônus de RENTABILIDADE (até 3 afiliados por nível)\r\n  ╔═════════════════╗\r\n  ║ Nível 1- (3,33% * 3) = 9%  \r\n  ║ Nível 2- (2,33% * 3) = 7%     ╠ 20% 💵\r\n  ║ Nível 3- (1,33% * 3) = 4%   \r\n  ╚═════════════════╝', 197.00, 6.00, 'auto'),
(3, 'gold', '  🥇Smart Gold (até 8% ao mês) – R$ 297,00\r\n\r\n  Bônus de ADESÃO (Ilimitado)\r\n  ╔═════════╗\r\n  ║ Nível 1 - 35%  \r\n  ║ Nível 2 - 10%  ╠ 50% 💵\r\n  ║ Nível 3 - 5%  \r\n  ╚═════════╝\r\n  \r\n  Bônus de RENTABILIDADE (até 3 afiliados por nível)\r\n  ╔═════════════════╗\r\n  ║ Nível 1- (4,00% * 3) = 12%  \r\n  ║ Nível 2- (2,66% * 3) = 8%     ╠ 25% 💵\r\n  ║ Nível 3- (1,66% * 3) = 5%   \r\n  ╚═════════════════╝', 297.00, 8.00, 'auto'),
(5, '🤖 Smart Bot', '  🤖 Smart Bot – R$397,00 (MENSAL)\r\n  Smart Bot – R$4.699,00 (VITALÍCIO)\r\n  • Gerenciamento avançado.\r\n  • Analisa mais de 17 estratégias e\r\n  encontra as melhores oportunidades.\r\n  • Operações automatizadas.\r\n  • Opera no mercado aberto e OTC.\r\n  • Stop WIN/LOSS.\r\n  • Martin Gale e Soros.\r\n  • Mais de 90% de assertividade.', 0.00, 0.00, 'manual'),
(6, '🎰 Alavancagem de banca', '  🎰 Alavancagem de banca:\n  \n  Aumente em até 5 vezes o valor de sua\n  banca em uma sessão individual com um\n  Trader de nossa equipe.\n\n  *Embora nossa Equipe tenha um\n  histórico de êxito nas operações,\n  o mercado de renda variável não\n  possibilita garantias que ganhos\n  passados representarão resultados\n  futuros.', 0.00, 0.00, 'manual'),
(4, 'diamond', '  💎Smart Diamond (até 8% ao mês) – R$ 297,00\r\n\r\n  Bônus de ADESÃO (Ilimitado)\r\n  ╔═════════╗\r\n  ║ Nível 1 - 35%  \r\n  ║ Nível 2 - 10%  ╠ 50% 💵\r\n  ║ Nível 3 - 5%  \r\n  ╚═════════╝\r\n  \r\n  Bônus de RENTABILIDADE (até 3 afiliados por nível)\r\n  ╔═════════════════╗\r\n  ║ Nível 1- (4,00% * 3) = 12%  \r\n  ║ Nível 2- (2,66% * 3) = 8%     ╠ 25% 💵\r\n  ║ Nível 3- (1,66% * 3) = 5%   \r\n  ╚═════════════════╝', 297.00, 8.00, 'auto');

-- --------------------------------------------------------

--
-- Estrutura da tabela `product_earnings`
--

CREATE TABLE `product_earnings` (
  `id` bigint(20) NOT NULL,
  `product_id` bigint(20) NOT NULL,
  `level` enum('1','2','3') NOT NULL,
  `type` enum('subscription','earnings') NOT NULL,
  `percentage` decimal(5,2) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estrutura da tabela `requests`
--

CREATE TABLE `requests` (
  `id` bigint(20) NOT NULL,
  `type` enum('support','service') NOT NULL,
  `subject` longtext NOT NULL,
  `is_read` int(11) NOT NULL DEFAULT '0',
  `user_id` bigint(20) NOT NULL,
  `telegram_user_id` bigint(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estrutura da tabela `users`
--

CREATE TABLE `users` (
  `id` bigint(20) NOT NULL,
  `name` varchar(255) NOT NULL,
  `surname` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role_id` bigint(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

--
-- Extraindo dados da tabela `users`
--

INSERT INTO `users` (`id`, `name`, `surname`, `email`, `password`, `role_id`, `created_at`) VALUES
(1, 'sr', 'admin', 'admin@admin.com', '5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8', 1, '2023-12-07 03:24:26');

-- --------------------------------------------------------

--
-- Estrutura da tabela `users_plans`
--

CREATE TABLE `users_plans` (
  `id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `product_id` bigint(20) NOT NULL,
  `status` int(11) NOT NULL DEFAULT '1',
  `acquired_in` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expired_in` timestamp NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estrutura da tabela `verification_email`
--

CREATE TABLE `verification_email` (
  `id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `token` varchar(255) NOT NULL,
  `status` enum('pending','expired','checked') NOT NULL DEFAULT 'pending'
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Estrutura da tabela `withdrawals`
--

CREATE TABLE `withdrawals` (
  `id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `value` decimal(10,2) NOT NULL,
  `status` enum('pending','authorized','refused','failed','success') NOT NULL DEFAULT 'pending',
  `reply_observation` longtext,
  `errors_cause` varchar(255) DEFAULT NULL,
  `reference_id` varchar(255) NOT NULL,
  `transaction_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

--
-- Índices para tabelas despejadas
--

--
-- Índices para tabela `balance`
--
ALTER TABLE `balance`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `bot_users`
--
ALTER TABLE `bot_users`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `checkouts`
--
ALTER TABLE `checkouts`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `network`
--
ALTER TABLE `network`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `product_earnings`
--
ALTER TABLE `product_earnings`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `requests`
--
ALTER TABLE `requests`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `users_plans`
--
ALTER TABLE `users_plans`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `verification_email`
--
ALTER TABLE `verification_email`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `withdrawals`
--
ALTER TABLE `withdrawals`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT de tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `balance`
--
ALTER TABLE `balance`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `bot_users`
--
ALTER TABLE `bot_users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `checkouts`
--
ALTER TABLE `checkouts`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `network`
--
ALTER TABLE `network`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `products`
--
ALTER TABLE `products`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT de tabela `product_earnings`
--
ALTER TABLE `product_earnings`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `requests`
--
ALTER TABLE `requests`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de tabela `users_plans`
--
ALTER TABLE `users_plans`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `verification_email`
--
ALTER TABLE `verification_email`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `withdrawals`
--
ALTER TABLE `withdrawals`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;
COMMIT;
