-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Tempo de geração: 01-Dez-2023 às 02:07
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
  `origin` enum('deposit','withdraw','earnings','subscription','tuition') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `transaction_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Extraindo dados da tabela `balance`
--

INSERT INTO `balance` (`id`, `value`, `user_id`, `type`, `origin`, `transaction_id`, `created_at`) VALUES
(19, '230.30', 10, 'sum', 'deposit', '74', '2023-11-27 01:09:06'),
(18, '63.70', 10, 'sum', 'deposit', '73', '2023-11-27 01:02:12'),
(20, '97.00', 10, 'subtract', 'subscription', '72', '2023-11-28 01:02:12'),
(21, '17.12', 10, 'subtract', 'withdraw', '4', '2023-11-28 02:32:13'),
(22, '93.40', 49, 'sum', 'deposit', '80', '2023-11-28 06:57:29'),
(23, '32.01', 48, 'sum', 'subscription', NULL, '2023-11-28 07:11:02'),
(24, '100.00', 48, 'sum', 'deposit', '87', '2023-11-28 07:41:55'),
(25, '100.00', 48, 'sum', 'deposit', '89', '2023-11-28 07:52:28');

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
  `pix_code` varchar(255) NOT NULL,
  `status` int NOT NULL DEFAULT '1',
  `telegram_user_id` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verified_email_at` timestamp NULL DEFAULT NULL,
  `last_activity` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Extraindo dados da tabela `bot_users`
--

INSERT INTO `bot_users` (`id`, `name`, `email`, `password`, `phone_number`, `adress`, `pix_code`, `status`, `telegram_user_id`, `created_at`, `verified_email_at`, `last_activity`) VALUES
(10, 'issa gomes', 'issagomes2002@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '84957349', 'hgtvfrd', 'hbgvfcdx', 1, 1743885934, '2023-11-18 13:29:17', '2023-11-17 03:00:00', '2023-12-01 02:06:04'),
(25, 'liza', 'liza@mail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', 'hbtgvfrcd', 'bgvfcd', 'vfdcxs', 1, NULL, '2023-11-19 21:54:29', '2023-11-09 09:30:39', '2023-11-26 16:49:30'),
(24, 'lilian Barro', 'gvfrcd', '6367c48dd193d56ea7b0baad25b19455e529f5ee', 'hybgtfrd', 'nhbgvfd', 'hbgvfcd', 1, NULL, '2023-11-19 21:46:43', '2023-11-01 21:53:05', '2023-11-20 19:53:56'),
(23, 'leandro henrique', 'leo_hen@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '543', 'vgfcd', 'gvfcd', 1, NULL, '2023-11-19 21:41:38', '2023-11-19 21:43:24', '2023-11-19 21:43:58'),
(26, 'Hayssa gomes', 'Haygomes1@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '827372828272', 'Hehehshsh', 'Sggsshsh', 1, NULL, '2023-11-20 19:56:53', NULL, '2023-11-20 19:56:53'),
(27, 'Luiz HENrique marrotos', 'Hehshs', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '2763737227', 'Gdhshsh', 'Egehw', 1, NULL, '2023-11-20 20:00:13', NULL, '2023-11-20 20:00:13'),
(28, 'Andre marcos', 'Andre@mail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '7372828', 'Shahha', 'Sggssh', 1, NULL, '2023-11-20 20:44:54', '2023-11-20 20:45:40', '2023-11-22 16:16:32'),
(31, 'Barbara Ramos', 'barbaraR@mail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '26267272', 'Sggshsh', 'Shhshs', 1, NULL, '2023-11-20 20:53:56', '2023-11-20 20:55:50', '2023-11-20 20:58:23'),
(29, 'Livia Pereira Barros de Melo', 'Livia@mail', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '4572627272', 'Sggsgsgsg', 'Syhshs', 1, NULL, '2023-11-20 20:47:43', NULL, '2023-11-20 20:47:43'),
(30, 'Livia pereira', 'Livia@email.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '36637272', 'Ehshhshs', 'Ehshhs', 1, NULL, '2023-11-20 20:51:03', NULL, '2023-11-20 20:51:03'),
(32, 'David Polo', 'davidp@mail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '626262626', 'Sygsgsgs', 'Whwhw', 1, NULL, '2023-11-20 20:58:14', NULL, '2023-11-20 20:58:14'),
(37, 'hayssa gomes', 'hayssagomes2002@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '887573475894', 'jhgfds', 'hgbfvdc', 1, NULL, '2023-11-23 01:18:50', '2023-11-23 01:19:47', '2023-11-23 01:21:21'),
(38, 'luccas', 'byiissag@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '81993852292', 'hgfdsa', 'bfvdcx', 1, NULL, '2023-11-23 01:21:01', '2023-11-23 01:24:12', '2023-11-24 19:48:16'),
(39, 'hayssa maria gomes', 'anaepapaizinho@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '6578439201', 'uyhjgkfdlspoewritug', 'thudfjska', 1, NULL, '2023-11-24 19:49:49', '2023-11-24 19:51:07', '2023-11-26 07:43:55'),
(41, 'testygdw', 'codedbyissa@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '68594032', 'hbgtvfrcde', 'sghvfcdx', 1, NULL, '2023-11-26 06:24:33', '2023-11-26 06:24:33', '0000-00-00 00:00:00'),
(42, 'hbgtvfcdxs', 'email@mail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '6589432', 'gvfcdx', 'hgtrfd', 1, NULL, '2023-11-26 09:23:16', '2023-11-26 09:23:16', '0000-00-00 00:00:00'),
(43, 'gvfcd', 'gtvrfd', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '574893', 'hgvfcd', 'bgvfc', 1, NULL, '2023-11-26 09:25:39', '2023-11-26 09:25:39', '0000-00-00 00:00:00'),
(44, 'gvfcdxs', 'issagomes@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '67849302', 'hbgvfc', 'bgvfd', 1, NULL, '2023-11-26 09:27:57', '2023-11-26 09:27:57', '0000-00-00 00:00:00'),
(45, 'hbgvfcd', 'liza@mail.co', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '75849302', 'hytgvrfd', 'dgvfcd', 1, NULL, '2023-11-26 09:31:29', '2023-11-26 09:31:29', '0000-00-00 00:00:00'),
(46, 'nhbgvfcd', 'bgvfcdx', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '65432', 'bgvfcd', 'xgvfcdx', 1, NULL, '2023-11-26 09:35:22', '2023-11-26 09:35:22', '0000-00-00 00:00:00'),
(48, 'hayssa g', 'byissag@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '6378920', 'thgrfdsczx', 'fgddcx', 1, NULL, '2023-11-28 06:11:05', '2023-11-28 06:11:45', '2023-11-28 07:53:06'),
(49, 'laura maria', 'byissag+teste1@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '5467382', 'hfgbfvs', 'hfgfv', 1, NULL, '2023-11-28 06:14:40', '2023-11-28 06:15:12', '2023-11-28 06:59:11'),
(50, 'renato marcos', 'byissag+teste2@gmail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '564783', 'hfgd', 'gnbf', 1, NULL, '2023-11-28 06:16:27', '2023-11-28 06:16:49', '2023-11-28 07:12:15');

-- --------------------------------------------------------

--
-- Estrutura da tabela `checkouts`
--

DROP TABLE IF EXISTS `checkouts`;
CREATE TABLE IF NOT EXISTS `checkouts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `reference_id` varchar(255) NOT NULL,
  `type` enum('deposit','subscription') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `value` decimal(10,2) NOT NULL,
  `status` enum('PENDING','AUTHORIZED','PAID','IN_ANALYSIS','DECLINED','CANCELED') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'PENDING',
  `transaction_id` varchar(255) DEFAULT NULL,
  `product_id` bigint DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=91 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Extraindo dados da tabela `checkouts`
--

INSERT INTO `checkouts` (`id`, `reference_id`, `type`, `value`, `status`, `transaction_id`, `product_id`, `user_id`, `created_at`) VALUES
(74, '207d3dc1-78bb-44fb-97c4-7e2bc64b8372', 'deposit', '230.30', 'PAID', 'CHEC_C399E6F9-4E7C-4ADE-AA06-1166EBE05905', NULL, 10, '2023-11-27 01:06:29'),
(72, 'c365ab09-63ab-4f6f-b8e5-9f6f7027420e', 'subscription', '97.00', 'PAID', 'CHEC_557ABC1F-D3BC-45C5-B8D4-F482A10CA984', 1, 10, '2023-11-27 00:58:39'),
(73, 'b15540f3-767f-41c9-a103-b2ec252c01e9', 'deposit', '63.70', 'PAID', 'CHEC_349DAE32-2166-49D7-B119-CA20E4566C3E', NULL, 10, '2023-11-27 01:01:00'),
(75, 'afa14d4f-f047-4e26-a0b7-34dab4bb9704', 'deposit', '544.50', 'DECLINED', 'CHEC_8D220F4E-444D-438F-BAAC-322F04C4CC59', NULL, 10, '2023-11-27 01:09:42'),
(76, 'c71aa675-c28e-4b24-9692-ef862a4a4fac', 'deposit', '654.54', 'PENDING', 'CHEC_F7DEDB15-EF5A-4008-978D-9D13B06EE415', NULL, 10, '2023-11-27 18:48:10'),
(77, '19e2fde5-60c2-4800-8735-7ae4545e35d3', 'subscription', '97.00', 'PAID', 'CHEC_F117F1ED-E97B-48CE-BF38-231F5C750A74', 1, 49, '2023-11-28 06:22:40'),
(81, 'ef57a296-a2fd-41e4-b0e6-8d4620a1eb29', 'subscription', '197.00', 'PAID', 'CHEC_17553137-5523-4951-BF6D-372EB622E4BB', 2, 48, '2023-11-28 07:00:48'),
(80, '7ced08ba-7461-46de-95fd-b88691c221c9', 'deposit', '93.40', 'PAID', 'CHEC_8ACD8A8C-0A7A-488A-A851-0D3C8F540F80', NULL, 49, '2023-11-28 06:56:39'),
(82, 'be078a03-7ab6-4fe5-a31f-9f5b49e11b7c', 'subscription', '97.00', 'PAID', 'CHEC_0C6AD75D-A698-4517-9C0E-40AB2F9CB9CB', 1, 48, '2023-11-28 07:03:02'),
(83, 'c3c45930-c15c-440c-a0c6-1019042c8d9d', 'subscription', '97.00', 'PAID', 'CHEC_4F4B9F4C-63D8-4E79-8771-3235921C6EB2', 1, 50, '2023-11-28 07:09:59'),
(84, '4fe0ea7b-1862-48e1-bdc5-6b9eb75aed66', 'subscription', '97.00', 'PAID', 'CHEC_F2D8C8F8-BBB6-4628-9A77-0543A09D7021', 1, 48, '2023-11-28 07:24:23'),
(85, '7b106bd9-2fd3-4a25-9a09-f1bf2d2372f7', 'subscription', '197.00', 'PENDING', 'CHEC_178E8504-5D8F-4180-BB91-8723D97771E0', 2, 48, '2023-11-28 07:27:22'),
(86, '14f3fe89-633b-4dd4-b685-3a45b694fac7', 'subscription', '97.00', 'PAID', 'CHEC_C2A612F3-BF3F-4AF5-B6D8-B0083ED788CC', 1, 48, '2023-11-28 07:39:48'),
(87, 'cd232703-9cab-4035-a447-d5e91679a395', 'deposit', '100.00', 'PAID', 'CHEC_FB3797BD-C9DA-4257-87CE-5242C73B6F94', 0, 48, '2023-11-28 07:41:03'),
(88, 'd2d84f25-76ad-454e-a491-ba24d834fff1', 'subscription', '97.00', 'PAID', 'CHEC_6F48D941-CEEF-4DB8-92F9-6065D645D592', 1, 48, '2023-11-28 07:45:26'),
(89, 'bb245884-41c4-4983-9ee8-9b67e53686a7', 'deposit', '100.00', 'PAID', 'CHEC_F4893C72-6805-4311-960A-A7BEA96739A1', 0, 48, '2023-11-28 07:51:15'),
(90, 'c7de0649-59f7-4449-b11f-3b0cc67cd0f0', 'subscription', '97.00', 'PENDING', 'CHEC_87136540-F9DE-4B90-BA47-1D1728CA90BE', 1, 10, '2023-12-01 02:03:57');

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
  `earnings` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Extraindo dados da tabela `network`
--

INSERT INTO `network` (`id`, `affiliate_user_id`, `guest_user_id`, `level`, `earnings`) VALUES
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
(31, 23, 46, '3', 1),
(32, 48, 49, '1', 1),
(33, 48, 50, '1', 1);

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
  `earnings_monthly` decimal(5,2) NOT NULL,
  `purchase_type` enum('auto','manual') NOT NULL DEFAULT 'auto',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Extraindo dados da tabela `products`
--

INSERT INTO `products` (`id`, `name`, `description`, `price`, `earnings_monthly`, `purchase_type`) VALUES
(1, 'bronze', '  🥉Smart Bronze (até 5% ao mês) – R$ 97,00\n\n  Bônus de ADESÃO (Ilimitado)\n  ╔═════════╗\n  ║ Nível 1- 30% \n  ║ Nível 2- 7%     ╠ 40% 💵\n  ║ Nível 3- 3%  \n  ╚═════════╝\n  \n  Bônus de RENTABILIDADE (até 3 afiliados por nível)\n  ╔═════════════════╗\n  ║ Nível 1- (2,33% * 3) = 7%  \n  ║ Nível 2- (1,66% * 3) = 5%     ╠ 15% 💵\n  ║ Nível 3- (1,00% * 3) = 3%   \n  ╚═════════════════╝', '97.00', '5.00', 'auto'),
(2, 'silver', '  🥈Smart silver (até 7% ao mês) – R$ 197,00\r\n\r\n  Bônus de ADESÃO (Ilimitado)\r\n  ╔═════════╗\r\n  ║ Nível 1- 33%  \r\n  ║ Nível 2- 8%     ╠ 45% 💵\r\n  ║ Nível 3- 4% \r\n  ╚═════════╝\r\n  \r\n  Bônus de RENTABILIDADE (até 3 afiliados por nível)\r\n  ╔═════════════════╗\r\n  ║ Nível 1- (3,33% * 3) = 9%  \r\n  ║ Nível 2- (2,33% * 3) = 7%     ╠ 20% 💵\r\n  ║ Nível 3- (1,33% * 3) = 4%   \r\n  ╚═════════════════╝', '197.00', '7.00', 'auto'),
(3, 'gold', '  🥇Smart gold (até 10% ao mês) – R$ 297,00\r\n\r\n  Bônus de ADESÃO (Ilimitado)\r\n  ╔═════════╗\r\n  ║ Nível 1 - 35%  \r\n  ║ Nível 2 - 10%  ╠ 50% 💵\r\n  ║ Nível 3 - 5%  \r\n  ╚═════════╝\r\n  \r\n  Bônus de RENTABILIDADE (até 3 afiliados por nível)\r\n  ╔═════════════════╗\r\n  ║ Nível 1- (4,00% * 3) = 12%  \r\n  ║ Nível 2- (2,66% * 3) = 8%     ╠ 25% 💵\r\n  ║ Nível 3- (1,66% * 3) = 5%   \r\n  ╚═════════════════╝', '297.00', '10.00', 'auto'),
(4, 'advanced management', '  🤖 Smart Bot – R$197,00 (MENSAL)\n  Smart Bot – R$1.297,00 (VITALÍCIO)\n  • Gerenciamento avançado.\n  • Analisa mais de 17 estratégias e\n  encontra as melhores oportunidades.\n  • Operações automatizadas.\n  • Opera no mercado aberto e OTC.\n  • Stop WIN/LOSS.\n  • Martin Gale e Soros.\n  • Mais de 90% de assertividade.', '0.00', '0.00', 'manual'),
(5, 'bank leverage', '  🎰 Alavancagem de banca:\r\n  \r\n  Aumente em até 5 vezes o valor de sua\r\n  banca em uma sessão individual com um\r\n  Trader de nossa equipe.\r\n\r\n  *Embora nossa Equipe tenha um\r\n  histórico de êxito nas operações,\r\n  o mercado de renda variável não\r\n  possibilita garantias que ganhos\r\n  passados representarão resultados\r\n  futuros.', '0.00', '0.00', 'manual');

-- --------------------------------------------------------

--
-- Estrutura da tabela `product_earnings`
--

DROP TABLE IF EXISTS `product_earnings`;
CREATE TABLE IF NOT EXISTS `product_earnings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `product_id` bigint NOT NULL,
  `level` enum('1','2','3') NOT NULL,
  `type` enum('subscription','earnings') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `percentage` decimal(5,2) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Extraindo dados da tabela `product_earnings`
--

INSERT INTO `product_earnings` (`id`, `product_id`, `level`, `type`, `percentage`) VALUES
(1, 1, '1', 'subscription', '30.00'),
(2, 1, '2', 'subscription', '7.00'),
(3, 1, '3', 'subscription', '3.00'),
(4, 1, '1', 'earnings', '2.33'),
(5, 1, '2', 'earnings', '1.66'),
(6, 1, '3', 'earnings', '1.00'),
(7, 2, '1', 'subscription', '33.00'),
(8, 2, '2', 'subscription', '8.00'),
(9, 2, '3', 'subscription', '4.00'),
(10, 2, '1', 'earnings', '3.33'),
(11, 2, '2', 'earnings', '2.33'),
(12, 2, '3', 'earnings', '1.33'),
(13, 3, '1', 'subscription', '35.00'),
(14, 3, '2', 'subscription', '10.00'),
(15, 3, '3', 'subscription', '5.00'),
(16, 3, '1', 'earnings', '4.00'),
(17, 3, '2', 'earnings', '2.66'),
(18, 3, '3', 'earnings', '1.66');

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
) ENGINE=MyISAM AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
(8, 'support', 'vcxz', 10, 1743885934, '2023-11-27 02:11:01'),
(10, 'service', '4', 48, 1743885934, '2023-11-28 07:23:13'),
(11, 'service', '4', 48, 1743885934, '2023-11-28 07:44:21'),
(12, 'support', 'meu saque do dia 28/11 as 04:50 da manha no valor de 100 reais foi negado, mesmo tendo saldo suficiente', 10, 1743885934, '2023-11-28 07:56:20'),
(13, 'service', '4', 10, 1743885934, '2023-12-01 02:03:34');

-- --------------------------------------------------------

--
-- Estrutura da tabela `users_plans`
--

DROP TABLE IF EXISTS `users_plans`;
CREATE TABLE IF NOT EXISTS `users_plans` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `product_id` bigint NOT NULL,
  `status` int NOT NULL DEFAULT '1',
  `acquired_in` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expired_in` timestamp NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Extraindo dados da tabela `users_plans`
--

INSERT INTO `users_plans` (`id`, `user_id`, `product_id`, `status`, `acquired_in`, `expired_in`) VALUES
(9, 25, 1, 1, '2023-11-27 00:59:33', '2023-12-27 00:59:33'),
(10, 49, 1, 1, '2023-11-28 06:23:47', '2023-12-28 06:23:47'),
(11, 48, 1, 1, '2023-12-28 07:46:57', '2023-12-28 07:46:57'),
(12, 50, 1, 1, '2023-11-28 07:11:02', '2023-12-28 07:11:02');

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
) ENGINE=MyISAM AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Extraindo dados da tabela `verification_email`
--

INSERT INTO `verification_email` (`id`, `user_id`, `token`, `status`) VALUES
(37, 50, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImJ5aXNzYWcrdGVzdGUyQGdtYWlsLmNvbSIsImlhdCI6MTcwMTE1MjE4NywiZXhwIjoxNzAxMTU1Nzg3fQ.Sc5yhNBHkHmrUxPegoApR_eFyeWfjsz_MWjVjjesLHE', 'checked'),
(36, 49, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImJ5aXNzYWcrdGVzdGUxQGdtYWlsLmNvbSIsImlhdCI6MTcwMTE1MjA4MCwiZXhwIjoxNzAxMTU1NjgwfQ.B3A6h3F0XWGcPhu9MNviv_ZYVtcmoJko0kcz3kCecdc', 'checked'),
(35, 48, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImJ5aXNzYWdAZ21haWwuY29tIiwiaWF0IjoxNzAxMTUxODkyLCJleHAiOjE3MDExNTU0OTJ9.9FjnI3q7wCEsoSNEBSBY6psnM0pLd1xYhhz9b8tHh2g', 'checked'),
(34, 48, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImJ5aXNzYWdAZ21haWwuY29tIiwiaWF0IjoxNzAxMTUxODY1LCJleHAiOjE3MDExNTU0NjV9.pJI-5tcbvk7MsARAk8VVIxgTy6t14bAi7BTHr0avPYQ', 'checked'),
(33, 47, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImJ5aXNzYWdAZ21haWwuY29tIiwiaWF0IjoxNzAxMTUxNjQwLCJleHAiOjE3MDExNTUyNDB9.w5PfUdV2T1-o07WB8KAkgB1mxKd1yIbPzs1X3-FZ0VY', 'checked');

-- --------------------------------------------------------

--
-- Estrutura da tabela `withdrawals`
--

DROP TABLE IF EXISTS `withdrawals`;
CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `value` decimal(10,2) NOT NULL,
  `status` enum('pending','authorized','refused') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'pending',
  `reply_observation` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `reference_id` varchar(255) NOT NULL,
  `transaction_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Extraindo dados da tabela `withdrawals`
--

INSERT INTO `withdrawals` (`id`, `user_id`, `value`, `status`, `reply_observation`, `reference_id`, `transaction_id`, `created_at`) VALUES
(4, 10, '17.12', 'authorized', NULL, '1bed10a3-ca1e-44e5-a54a-7b52336ddfb7', NULL, '2023-11-27 21:38:03'),
(6, 48, '100.00', 'pending', NULL, '553cc5e9-b9b3-416d-bbbd-6ce6399c888a', NULL, '2023-11-28 07:50:25');
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
