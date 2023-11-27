-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Tempo de geração: 27-Nov-2023 às 05:28
-- Versão do servidor: 8.0.31
-- versão do PHP: 8.1.13

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `smartoption`
--

-- --------------------------------------------------------

--
-- Estrutura da tabela `balance`
--

DROP TABLE IF EXISTS `balance`;
CREATE TABLE IF NOT EXISTS `balance` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `value` decimal(10,2) NOT NULL,
  `user_id` bigint NOT NULL,
  `type` enum('sum','subtract') NOT NULL,
  `origin` enum('deposit','withdraw','gain','product') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Extraindo dados da tabela `balance`
--

INSERT INTO `balance` (`id`, `value`, `user_id`, `type`, `origin`, `created_at`) VALUES
(19, '230.30', 10, 'sum', 'deposit', '2023-11-27 01:09:06'),
(18, '63.70', 10, 'sum', 'deposit', '2023-11-27 01:02:12');

-- --------------------------------------------------------

--
-- Estrutura da tabela `bot_users`
--

DROP TABLE IF EXISTS `bot_users`;
CREATE TABLE IF NOT EXISTS `bot_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `phone_number` varchar(255) NOT NULL,
  `adress` varchar(255) NOT NULL,
  `bank_name` varchar(255) NOT NULL,
  `bank_agency_number` varchar(255) NOT NULL,
  `bank_account_number` varchar(255) NOT NULL,
  `pix_code` varchar(255) NOT NULL,
  `status` int NOT NULL DEFAULT '1',
  `telegram_user_id` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verified_email_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_activity` timestamp NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Extraindo dados da tabela `bot_users`
--

INSERT INTO `bot_users` (`id`, `name`, `email`, `password`, `phone_number`, `adress`, `bank_name`, `bank_agency_number`, `bank_account_number`, `pix_code`, `status`, `telegram_user_id`, `created_at`, `verified_email_at`, `last_activity`) VALUES
(10, 'issa gomes', 'issagomes2002@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '84957349', 'hgtvfrd', 'hgtvrfcd', 'hbtgvrfc', 'dhtgvrfc', 'hbgvfcdx', 1, 1743885934, '2023-11-18 13:29:17', '2023-11-17 03:00:00', '2023-11-27 05:28:13'),
(25, 'liza', 'liza@mail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', 'hbtgvfrcd', 'bgvfcd', 'gtvrfcdx', 'hbgvfcd', 'bgvfcdx', 'vfdcxs', 1, NULL, '2023-11-19 21:54:29', '2023-11-09 09:30:39', '2023-11-26 16:49:30'),
(24, 'lilian barros', 'gvfrcd', '6367c48dd193d56ea7b0baad25b19455e529f5ee', 'hybgtfrd', 'nhbgvfd', 'hgfd', 'hbtgvrfcd', 'hbgvfcdx', 'hbgvfcd', 1, NULL, '2023-11-19 21:46:43', '2023-11-01 21:53:05', '2023-11-20 19:53:56'),
(23, 'leandro henrique', 'leo_hen@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '543', 'vgfcd', 'bvfcd', 'vfcdx', 'gvfcd', 'gvfcd', 1, NULL, '2023-11-19 21:41:38', '2023-11-19 21:43:24', '2023-11-19 21:43:58'),
(26, 'Hayssa gomes', 'Haygomes1@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '827372828272', 'Hehehshsh', 'Gegsgsgs', 'Egsgsgsg', 'Eggsgshshs', 'Sggsshsh', 1, NULL, '2023-11-20 19:56:53', NULL, '2023-11-20 19:56:53'),
(27, 'Luiz', 'Hehshs', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '2763737227', 'Gdhshsh', 'Sggssg', 'Egehwhw', 'Eywywy', 'Egehw', 1, NULL, '2023-11-20 20:00:13', NULL, '2023-11-20 20:00:13'),
(28, 'Andre marcos', 'Andre@mail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '7372828', 'Shahha', 'Eysyhs', 'Eysyhs', 'Syshhs', 'Sggssh', 1, NULL, '2023-11-20 20:44:54', '2023-11-20 20:45:40', '2023-11-22 16:16:32'),
(31, 'Barbara Ramos', 'barbaraR@mail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '26267272', 'Sggshsh', 'Dhhsh', 'Shhsh', 'Dhshsh', 'Shhshs', 1, NULL, '2023-11-20 20:53:56', '2023-11-20 20:55:50', '2023-11-20 20:58:23'),
(29, 'Livia Pereira', 'Livia@mail', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '4572627272', 'Sggsgsgsg', 'Ehhshsh', 'Sgsgvs', 'Shhshsgs', 'Syhshs', 1, NULL, '2023-11-20 20:47:43', NULL, '2023-11-20 20:47:43'),
(30, 'Livia pereira', 'Livia@email.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '36637272', 'Ehshhshs', 'Hehshsh', 'Hehshsh', 'Ehshhs', 'Ehshhs', 1, NULL, '2023-11-20 20:51:03', NULL, '2023-11-20 20:51:03'),
(32, 'David Polo', 'davidp@mail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '626262626', 'Sygsgsgs', 'Shhshs', 'Usyshsh', 'Shhshs', 'Whwhw', 1, NULL, '2023-11-20 20:58:14', NULL, '2023-11-20 20:58:14'),
(37, 'hayssa gomes', 'hayssagomes2002@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '887573475894', 'jhgfds', 'ikyjghfds', 'iuyjhtgfd', 'ukjyhgfd', 'hgbfvdc', 1, NULL, '2023-11-23 01:18:50', '2023-11-23 01:19:47', '2023-11-23 01:21:21'),
(38, 'luccas', 'byissag@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '81993852292', 'hgfdsa', 'bfgvdcs', 'bfvdcxz', 'bvdcs', 'bfvdcx', 1, NULL, '2023-11-23 01:21:01', '2023-11-23 01:24:12', '2023-11-24 19:48:16'),
(39, 'hayssa maria gomes', 'anaepapaizinho@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '6578439201', 'uyhjgkfdlspoewritug', 'trhbfdnsmkaower', 'gfhdbcnjxkal', 'tghfdjcsalk', 'thudfjska', 1, NULL, '2023-11-24 19:49:49', '2023-11-24 19:51:07', '2023-11-26 07:43:55'),
(41, 'testygdw', 'codedbyissa@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '68594032', 'hbgtvfrcde', 'hbgtvrfced', 'hgvfcd', 'hgvfcd', 'sghvfcdx', 1, NULL, '2023-11-26 06:24:33', '2023-11-26 06:24:33', '0000-00-00 00:00:00'),
(42, 'hbgtvfcdxs', 'email@mail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '6589432', 'gvfcdx', 'gtrfed', 'tgrfed', 'grfed', 'hgtrfd', 1, NULL, '2023-11-26 09:23:16', '2023-11-26 09:23:16', '0000-00-00 00:00:00'),
(43, 'gvfcd', 'gtvrfd', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '574893', 'hgvfcd', 'hbtgvfrc', 'dhgtvfc', 'htgvrfc', 'bgvfc', 1, NULL, '2023-11-26 09:25:39', '2023-11-26 09:25:39', '0000-00-00 00:00:00'),
(44, 'gvfcdxs', 'issagomes@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '67849302', 'hbgvfc', 'ghtvfrc', 'gfvdc', 'vfcdx', 'bgvfd', 1, NULL, '2023-11-26 09:27:57', '2023-11-26 09:27:57', '0000-00-00 00:00:00'),
(45, 'hbgvfcd', 'liza@mail.co', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '75849302', 'hytgvrfd', 'htgvrfcd', 'hgtvrfcd', 'tgvfrc', 'dgvfcd', 1, NULL, '2023-11-26 09:31:29', '2023-11-26 09:31:29', '0000-00-00 00:00:00'),
(46, 'nhbgvfcd', 'bgvfcdx', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '65432', 'bgvfcd', 'hbgvfcdx', 'gvfcdx', 'gvfcd', 'xgvfcdx', 1, NULL, '2023-11-26 09:35:22', '2023-11-26 09:35:22', '0000-00-00 00:00:00');

-- --------------------------------------------------------

--
-- Estrutura da tabela `checkouts`
--

DROP TABLE IF EXISTS `checkouts`;
CREATE TABLE IF NOT EXISTS `checkouts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `reference_id` varchar(255) NOT NULL,
  `type` enum('deposit','product') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `value` decimal(10,2) NOT NULL,
  `status` enum('PENDING','AUTHORIZED','PAID','IN_ANALYSIS','DECLINED','CANCELED') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'PENDING',
  `transaction_id` varchar(255) DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  `product_id` bigint DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=76 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Extraindo dados da tabela `checkouts`
--

INSERT INTO `checkouts` (`id`, `reference_id`, `type`, `value`, `status`, `transaction_id`, `user_id`, `product_id`, `created_at`) VALUES
(74, '207d3dc1-78bb-44fb-97c4-7e2bc64b8372', 'deposit', '230.30', 'PAID', 'CHEC_C399E6F9-4E7C-4ADE-AA06-1166EBE05905', 10, NULL, '2023-11-27 01:06:29'),
(72, 'c365ab09-63ab-4f6f-b8e5-9f6f7027420e', 'product', '97.00', 'PAID', 'CHEC_557ABC1F-D3BC-45C5-B8D4-F482A10CA984', 10, 1, '2023-11-27 00:58:39'),
(73, 'b15540f3-767f-41c9-a103-b2ec252c01e9', 'deposit', '63.70', 'PAID', 'CHEC_349DAE32-2166-49D7-B119-CA20E4566C3E', 10, NULL, '2023-11-27 01:01:00'),
(75, 'afa14d4f-f047-4e26-a0b7-34dab4bb9704', 'deposit', '544.50', 'DECLINED', 'CHEC_8D220F4E-444D-438F-BAAC-322F04C4CC59', 10, NULL, '2023-11-27 01:09:42');

-- --------------------------------------------------------

--
-- Estrutura da tabela `network`
--

DROP TABLE IF EXISTS `network`;
CREATE TABLE IF NOT EXISTS `network` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `affiliate_user_id` bigint NOT NULL,
  `guest_user_id` bigint NOT NULL,
  `level` enum('1','2','3') NOT NULL,
  `profitability` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Extraindo dados da tabela `network`
--

INSERT INTO `network` (`id`, `affiliate_user_id`, `guest_user_id`, `level`, `profitability`) VALUES
(1, 10, 23, '1', 1),
(2, 23, 24, '1', 0),
(3, 10, 24, '2', 0),
(4, 24, 25, '1', 0),
(5, 23, 25, '2', 0),
(6, 10, 25, '3', 0),
(8, 0, 29, '1', 0),
(9, 28, 30, '1', 0),
(10, 28, 31, '1', 0),
(11, 31, 32, '1', 0),
(12, 28, 32, '2', 0),
(13, 10, 33, '1', 1),
(14, 37, 38, '1', 0),
(15, 38, 39, '1', 0),
(16, 37, 39, '2', 0),
(17, 39, 40, '1', 0),
(18, 38, 40, '2', 0),
(19, 37, 40, '3', 0),
(20, 39, 41, '1', 0),
(21, 38, 41, '2', 0),
(22, 37, 41, '3', 0),
(23, 10, 42, '1', 1),
(25, 10, 44, '1', 0),
(26, 25, 45, '1', 1),
(27, 24, 45, '2', 1),
(28, 23, 45, '3', 1),
(29, 25, 46, '1', 1),
(30, 24, 46, '2', 1),
(31, 23, 46, '3', 1);

-- --------------------------------------------------------

--
-- Estrutura da tabela `products`
--

DROP TABLE IF EXISTS `products`;
CREATE TABLE IF NOT EXISTS `products` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `monthly_profit` decimal(5,2) NOT NULL,
  `purchase_type` enum('auto','manual') NOT NULL DEFAULT 'auto',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Extraindo dados da tabela `products`
--

INSERT INTO `products` (`id`, `name`, `description`, `price`, `monthly_profit`, `purchase_type`) VALUES
(1, 'bronze', '  🥉Smart Bronze (até 5% ao mês) – R$ 97,00\n\n  Bônus de ADESÃO (Ilimitado)\n  ╔═════════╗\n  ║ Nível 1- 30% \n  ║ Nível 2- 7%     ╠ 40% 💵\n  ║ Nível 3- 3%  \n  ╚═════════╝\n  \n  Bônus de RENTABILIDADE (até 3 afiliados por nível)\n  ╔═════════════════╗\n  ║ Nível 1- (2,33% * 3) = 7%  \n  ║ Nível 2- (1,66% * 3) = 5%     ╠ 15% 💵\n  ║ Nível 3- (1,00% * 3) = 3%   \n  ╚═════════════════╝', '97.00', '5.00', 'auto'),
(2, 'silver', '  🥈Smart silver (até 7% ao mês) – R$ 197,00\r\n\r\n  Bônus de ADESÃO (Ilimitado)\r\n  ╔═════════╗\r\n  ║ Nível 1- 33%  \r\n  ║ Nível 2- 8%     ╠ 45% 💵\r\n  ║ Nível 3- 4% \r\n  ╚═════════╝\r\n  \r\n  Bônus de RENTABILIDADE (até 3 afiliados por nível)\r\n  ╔═════════════════╗\r\n  ║ Nível 1- (3,33% * 3) = 9%  \r\n  ║ Nível 2- (2,33% * 3) = 7%     ╠ 20% 💵\r\n  ║ Nível 3- (1,33% * 3) = 4%   \r\n  ╚═════════════════╝', '197.00', '7.00', 'auto'),
(3, 'gold', '  🥇Smart gold (até 10% ao mês) – R$ 297,00\r\n\r\n  Bônus de ADESÃO (Ilimitado)\r\n  ╔═════════╗\r\n  ║ Nível 1 - 35%  \r\n  ║ Nível 2 - 10%  ╠ 50% 💵\r\n  ║ Nível 3 - 5%  \r\n  ╚═════════╝\r\n  \r\n  Bônus de RENTABILIDADE (até 3 afiliados por nível)\r\n  ╔═════════════════╗\r\n  ║ Nível 1- (4,00% * 3) = 12%  \r\n  ║ Nível 2- (2,66% * 3) = 8%     ╠ 25% 💵\r\n  ║ Nível 3- (1,66% * 3) = 5%   \r\n  ╚═════════════════╝', '297.00', '10.00', 'auto'),
(4, 'advanced management', '  🤖 Smart Bot – R$197,00 (MENSAL)\r\n  Smart Bot – R$1.297,00 (VITALÍCIO)\r\n  • Gerenciamento avançado.\r\n  • Analisa mais de 17 estratégias e\r\n  encontra as melhores oportunidades.\r\n  • Operações automatizadas.\r\n  • Opera no mercado aberto e OTC.\r\n  • Stop WIN/LOSS.\r\n  • Martin Gale e Soros.\r\n  • Mais de 90% de assertividade.', '0.00', '0.00', 'manual'),
(5, 'bank leverage', '  🎰 Alavancagem de banca:\r\n  \r\n  Aumente em até 5 vezes o valor de sua\r\n  banca em uma sessão individual com um\r\n  Trader de nossa equipe.\r\n\r\n  *Embora nossa Equipe tenha um\r\n  histórico de êxito nas operações,\r\n  o mercado de renda variável não\r\n  possibilita garantias que ganhos\r\n  passados representarão resultados\r\n  futuros.', '0.00', '0.00', 'manual');

-- --------------------------------------------------------

--
-- Estrutura da tabela `product_gains`
--

DROP TABLE IF EXISTS `product_gains`;
CREATE TABLE IF NOT EXISTS `product_gains` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` bigint NOT NULL,
  `level` enum('1','2','3') NOT NULL,
  `type` enum('accession','profitability') NOT NULL,
  `percentage` decimal(5,2) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Extraindo dados da tabela `product_gains`
--

INSERT INTO `product_gains` (`id`, `product_id`, `level`, `type`, `percentage`) VALUES
(1, 1, '1', 'accession', '30.00'),
(2, 1, '2', 'accession', '7.00'),
(3, 1, '3', 'accession', '3.00'),
(4, 1, '1', 'profitability', '7.00'),
(5, 1, '2', 'profitability', '5.00'),
(6, 1, '3', 'profitability', '3.00'),
(7, 2, '1', 'accession', '33.00'),
(8, 2, '2', 'accession', '8.00'),
(9, 2, '3', 'accession', '4.00'),
(10, 2, '1', 'profitability', '9.00'),
(11, 2, '2', 'profitability', '7.00'),
(12, 2, '3', 'profitability', '4.00'),
(13, 3, '1', 'accession', '35.00'),
(14, 3, '2', 'accession', '10.00'),
(15, 3, '3', 'accession', '5.00'),
(16, 3, '1', 'profitability', '12.00'),
(17, 3, '2', 'profitability', '8.00'),
(18, 3, '3', 'profitability', '5.00');

-- --------------------------------------------------------

--
-- Estrutura da tabela `requests`
--

DROP TABLE IF EXISTS `requests`;
CREATE TABLE IF NOT EXISTS `requests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `type` enum('support','service') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `subject` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `user_id` bigint NOT NULL,
  `telegram_user_id` bigint NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Extraindo dados da tabela `requests`
--

INSERT INTO `requests` (`id`, `type`, `subject`, `user_id`, `telegram_user_id`, `created_at`) VALUES
(1, 'service', '4', 10, 1743885934, '2023-11-27 01:44:06'),
(5, 'support', 'gfds', 10, 1743885934, '2023-11-27 02:09:09'),
(3, 'support', 'estou com problemas para realizar saques', 10, 1743885934, '2023-11-27 02:04:11'),
(4, 'support', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet. Duis sagittis ipsum. Praesent mauris. Fusce nec tellus sed augue semper porta. ', 10, 1743885934, '2023-11-27 02:04:56'),
(6, 'support', 'gvfcdxs', 10, 1743885934, '2023-11-27 02:09:38'),
(7, 'support', 'vfcdxs', 10, 1743885934, '2023-11-27 02:09:40'),
(8, 'support', 'vcxz', 10, 1743885934, '2023-11-27 02:11:01');

-- --------------------------------------------------------

--
-- Estrutura da tabela `users_plans`
--

DROP TABLE IF EXISTS `users_plans`;
CREATE TABLE IF NOT EXISTS `users_plans` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `checkout_id` bigint NOT NULL,
  `status` int NOT NULL DEFAULT '1',
  `acquired_in` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expired_in` timestamp NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Extraindo dados da tabela `users_plans`
--

INSERT INTO `users_plans` (`id`, `user_id`, `product_id`, `checkout_id`, `status`, `acquired_in`, `expired_in`) VALUES
(9, 10, 1, 72, 1, '2023-11-27 00:59:33', '2023-12-27 00:59:33');

-- --------------------------------------------------------

--
-- Estrutura da tabela `verification_email`
--

DROP TABLE IF EXISTS `verification_email`;
CREATE TABLE IF NOT EXISTS `verification_email` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `token` varchar(255) NOT NULL,
  `status` enum('pending','expired','checked') NOT NULL DEFAULT 'pending',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `withdrawals`
--

DROP TABLE IF EXISTS `withdrawals`;
CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `value` decimal(10,2) NOT NULL,
  `status` enum('pending','paid','denied') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `reference_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
