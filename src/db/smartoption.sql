-- phpMyAdmin SQL Dump
-- version 4.9.11
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Tempo de geração: 09-Fev-2024 às 14:46
-- Versão do servidor: 5.7.39
-- versão do PHP: 5.6.5

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
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

CREATE TABLE `balance` (
  `id` bigint(20) NOT NULL,
  `value` decimal(10,2) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `type` enum('sum','subtract') NOT NULL,
  `origin` enum('deposit','withdrawal','earnings','profitability','subscription','tuition','transfer','admin') NOT NULL,
  `reference_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

--
-- Extraindo dados da tabela `balance`
--

INSERT INTO `balance` (`id`, `value`, `user_id`, `type`, `origin`, `reference_id`, `created_at`) VALUES
(19, 230.30, 10, 'sum', 'deposit', '74', 0x323032332d31312d32372030313a30393a3036),
(18, 63.70, 10, 'sum', 'deposit', '73', 0x323032332d31312d32372030313a30323a3132),
(20, 97.00, 10, 'subtract', 'subscription', '72', 0x323032332d31312d32382030313a30323a3132),
(51, 43.00, 24, 'sum', 'admin', NULL, 0x323032332d31322d33302030393a31313a3233),
(22, 93.40, 49, 'sum', 'deposit', '80', 0x323032332d31312d32382030363a35373a3239),
(23, 32.01, 10, 'sum', 'subscription', '72', 0x323032332d31312d32382030373a31313a3032),
(24, 100.00, 48, 'sum', 'deposit', '87', 0x323032332d31312d32382030373a34313a3535),
(25, 100.00, 48, 'sum', 'deposit', '89', 0x323032332d31312d32382030373a35323a3238),
(27, 97.00, 10, 'subtract', 'subscription', NULL, 0x323032332d31322d30352030313a35353a3230),
(28, 0.13, 10, 'sum', 'profitability', '23', 0x323032332d31322d30352030323a32333a3539),
(29, 1.50, 10, 'sum', 'earnings', '', 0x323032332d31312d30352030323a33353a3236),
(33, 100.00, 10, 'sum', 'deposit', '94', 0x323032332d31322d31332031313a33373a3031),
(31, 100.00, 10, 'sum', 'deposit', NULL, 0x323032332d31322d30352030323a33373a3231),
(32, 97.00, 10, 'subtract', 'tuition', NULL, 0x323032332d31322d30352030323a33363a3435),
(34, 97.00, 10, 'subtract', 'subscription', NULL, 0x323032332d31322d31332031333a31383a3137),
(50, 300.00, 25, 'sum', 'admin', NULL, 0x323032332d31322d33302030393a30323a3432),
(37, 1.00, 10, 'sum', 'tuition', '94', 0x323032332d31322d30352030323a33363a3435),
(38, 13.00, 10, 'sum', 'admin', NULL, 0x323032332d31322d32372030393a31343a3030),
(39, 10.00, 10, 'subtract', 'admin', NULL, 0x323032332d31322d32372030393a31343a3437),
(40, 10.32, 10, 'sum', 'admin', NULL, 0x323032332d31322d32372030393a31353a3333),
(41, 100.00, 23, 'subtract', 'admin', NULL, 0x323032332d31322d32372030393a32313a3334),
(42, 217.76, 23, 'sum', 'admin', NULL, 0x323032332d31322d32372030393a32313a3531),
(43, 100.00, 10, 'sum', 'admin', NULL, 0x323032332d31322d32372030393a32323a3534),
(44, 97.00, 10, 'subtract', 'tuition', NULL, 0x323032332d31322d32372030393a33383a3030),
(49, 17.12, 10, 'subtract', 'withdrawal', '4', 0x323032332d31322d32382030343a30363a3536),
(46, 100.00, 10, 'sum', 'admin', NULL, 0x323032332d31322d32372032313a35383a3536),
(52, 39.00, 50, 'sum', 'admin', NULL, 0x323032332d31322d33302030393a31373a3336),
(53, 100.54, 63, 'sum', 'deposit', '108', 0x323032342d30322d30362032323a30383a3432),
(58, 100.00, 63, 'subtract', 'transfer', '10', 0x323032342d30322d30392031343a32333a3132),
(59, 100.00, 10, 'sum', 'transfer', '63', 0x323032342d30322d30392031343a32333a3132);

-- --------------------------------------------------------

--
-- Estrutura da tabela `bot_users`
--

CREATE TABLE `bot_users` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `cpf` varchar(255) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `phone_number` varchar(255) NOT NULL,
  `adress` varchar(255) NOT NULL,
  `pix_code` varchar(255) NOT NULL,
  `is_active` int(11) NOT NULL DEFAULT '1',
  `telegram_user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verified_email_at` timestamp NULL DEFAULT NULL,
  `last_activity` timestamp NULL DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

--
-- Extraindo dados da tabela `bot_users`
--

INSERT INTO `bot_users` (`id`, `name`, `email`, `cpf`, `password`, `phone_number`, `adress`, `pix_code`, `is_active`, `telegram_user_id`, `created_at`, `verified_email_at`, `last_activity`) VALUES
(10, 'Issa Maria Gom', 'issagomes2002@gmail.com', '13105628495', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '84957349', 'rua don leon', '13105628495', 1, 1743885934, 0x323032332d31312d31382031333a32393a3137, 0x323032332d31312d31372030333a30303a3030, 0x323032342d30322d30392031343a34303a3131),
(25, 'liza', 'liza@mail.com', 'fe', '6367c48dd193d56ea7b0baad25b19455e529f5ee', 'hbtgvfrcd', 'bgvfcd', 'vfdcxs', 0, NULL, 0x323032332d31312d31392032313a35343a3239, 0x323032332d31312d30392030393a33303a3339, 0x323032332d31312d32362031363a34393a3330),
(24, 'lilian Barro', 'gvfrcd', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', 'hybgtfrd', 'nhbgvfd', 'hbgvfcd', 1, NULL, 0x323032332d31312d31392032313a34363a3433, 0x323032332d31312d30312032313a35333a3035, 0x323032332d31312d32302031393a35333a3536),
(23, 'leandro henrique', 'leo_hen@gmail.com', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '543', 'vgfcd', 'gvfcd', 0, NULL, 0x323032332d31312d31392032313a34313a3338, 0x323032332d31312d31392032313a34333a3234, 0x323032332d31312d31392032313a34333a3538),
(26, 'Hayssa gomes', 'Haygomes1@gmail.com', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '827372828272', 'Hehehshsh', 'Sggsshsh', 0, NULL, 0x323032332d31312d32302031393a35363a3533, NULL, 0x323032332d31312d32302031393a35363a3533),
(27, 'Luiz HENrique marrotos', 'Hehshs', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '2763737227', 'Gdhshsh', 'Egehw', 1, NULL, 0x323032332d31312d32302032303a30303a3133, NULL, 0x323032332d31312d32302032303a30303a3133),
(28, 'Andre marcos', 'Andre@mail.com', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '7372828', 'Shahha', 'Sggssh', 1, NULL, 0x323032332d31312d32302032303a34343a3534, 0x323032332d31312d32302032303a34353a3430, 0x323032332d31312d32322031363a31363a3332),
(31, 'Barbara Ramos', 'barbaraR@mail.com', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '26267272', 'Sggshsh', 'Shhshs', 1, NULL, 0x323032332d31312d32302032303a35333a3536, 0x323032332d31312d32302032303a35353a3530, 0x323032332d31312d32302032303a35383a3233),
(29, 'Livia Pereira Barros de Melo', 'Livia@mail', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '4572627272', 'Sggsgsgsg', 'Syhshs', 1, NULL, 0x323032332d31312d32302032303a34373a3433, NULL, 0x323032332d31312d32302032303a34373a3433),
(30, 'Livia pereira', 'Livia@email.com', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '36637272', 'Ehshhshs', 'Ehshhs', 1, NULL, 0x323032332d31312d32302032303a35313a3033, NULL, 0x323032332d31312d32302032303a35313a3033),
(32, 'David Polo', 'davidp@mail.com', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '626262626', 'Sygsgsgs', 'Whwhw', 1, NULL, 0x323032332d31312d32302032303a35383a3134, NULL, 0x323032332d31312d32302032303a35383a3134),
(37, 'hayssa gomes', 'hayssagomes2002@gmail.com', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '887573475894', 'jhgfds', 'hgbfvdc', 1, NULL, 0x323032332d31312d32332030313a31383a3530, 0x323032332d31312d32332030313a31393a3437, 0x323032332d31312d32332030313a32313a3231),
(38, 'luccas', 'byiissag@gmail.com', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '81993852292', 'hgfdsa', 'bfvdcx', 1, NULL, 0x323032332d31312d32332030313a32313a3031, 0x323032332d31312d32332030313a32343a3132, 0x323032332d31312d32342031393a34383a3136),
(39, 'hayssa maria gomes', 'anaepapaizinho@gmail.com', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '6578439201', 'uyhjgkfdlspoewritug', 'thudfjska', 1, NULL, 0x323032332d31312d32342031393a34393a3439, 0x323032332d31312d32342031393a35313a3037, 0x323032332d31312d32362030373a34333a3535),
(41, 'testygdw', 'codedbyissa@gmail.com', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '68594032', 'hbgtvfrcde', 'sghvfcdx', 1, NULL, 0x323032332d31312d32362030363a32343a3333, 0x323032332d31312d32362030363a32343a3333, 0x303030302d30302d30302030303a30303a3030),
(42, 'hbgtvfcdxs', 'email@mail.com', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '6589432', 'gvfcdx', 'hgtrfd', 1, NULL, 0x323032332d31312d32362030393a32333a3136, 0x323032332d31312d32362030393a32333a3136, 0x303030302d30302d30302030303a30303a3030),
(43, 'gvfcd', 'gtvrfd', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '574893', 'hgvfcd', 'bgvfc', 1, NULL, 0x323032332d31312d32362030393a32353a3339, 0x323032332d31312d32362030393a32353a3339, 0x303030302d30302d30302030303a30303a3030),
(44, 'gvfcdxs', 'issagomes@gmail.com', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '67849302', 'hbgvfc', 'bgvfd', 1, NULL, 0x323032332d31312d32362030393a32373a3537, 0x323032332d31312d32362030393a32373a3537, 0x303030302d30302d30302030303a30303a3030),
(45, 'hbgvfcd', 'liza@mail.co', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '75849302', 'hytgvrfd', 'dgvfcd', 1, NULL, 0x323032332d31312d32362030393a33313a3239, 0x323032332d31312d32362030393a33313a3239, 0x303030302d30302d30302030303a30303a3030),
(46, 'nhbgvfcd', 'bgvfcdx', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '65432', 'bgvfcd', 'xgvfcdx', 1, NULL, 0x323032332d31312d32362030393a33353a3232, 0x323032332d31312d32362030393a33353a3232, 0x303030302d30302d30302030303a30303a3030),
(48, 'hayssa g', 'byissag@gmail.com', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '6378920', 'thgrfdsczx', 'fgddcx', 1, NULL, 0x323032332d31312d32382030363a31313a3035, 0x323032332d31312d32382030363a31313a3435, 0x323032332d31312d32382030373a35333a3036),
(49, 'laura maria', 'byissag+teste1@gmail.com', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '5467382', 'hfgbfvs', 'hfgfv', 1, NULL, 0x323032332d31312d32382030363a31343a3430, 0x323032332d31312d32382030363a31353a3132, 0x323032332d31312d32382030363a35393a3131),
(50, 'renato marcos', 'byissag+teste2@gmail.com', '', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '564783', 'hfgd', 'gnbf', 1, NULL, 0x323032332d31312d32382030363a31363a3237, 0x323032332d31312d32382030363a31363a3439, 0x323032332d31312d32382030373a31323a3135),
(51, 'bgvfcx', 'gvfdcx', '54354353453', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '545435', 'hbgvfdc', 'hbgvfc', 1, NULL, 0x323032332d31322d31332031303a35333a3031, NULL, NULL),
(52, 'julia Maria G', 'issagomes2002+t@gmail.com', '13105628495', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '84957349', 'rua don leon', '13105628495', 1, NULL, 0x323032332d31322d32362030363a34373a3432, NULL, NULL),
(53, 'julia Maria G', 'issagomes2002+tw@gmail.com', '13105628495', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '84957349', 'rua don leon', '13105628495', 1, NULL, 0x323032332d31322d32362030363a34383a3232, NULL, NULL),
(54, 'Liassir M G', 'issagomes2002+twt@gmail.com', '13105628495', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '84957349', 'rua don leon', '13105628495', 1, NULL, 0x323032332d31322d32362031383a32313a3134, NULL, NULL),
(55, 'Hayssa Gomes2', 'issagomes2002+hbzj@gmail.com', '43546', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '81993852292', 'Paratibe rua Madri N19', 'dfcvbgfv', 1, NULL, 0x323032332d31322d32362031393a31323a3439, NULL, NULL),
(56, 'dcx', 'vdcx', 'cefce', '6367c48dd193d56ea7b0baad25b19455e529f5ee', 'edcsx', 'dsx', 'edsx', 1, NULL, 0x323032332d31322d32362031393a34363a3034, NULL, NULL),
(57, 'Hayssa Gomes', 'issagomes2002+2w@gmail.com', 'fd', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '81993852292', 'Paratibe rua Madri N19', 'fvc', 1, NULL, 0x323032332d31322d32362032313a30303a3530, NULL, NULL),
(58, 'Hayssa Gomes', 'issagomes2002+13@gmail.com', 'dff', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '81993852292', 'Paratibe rua Madri N19', 'bfb', 1, NULL, 0x323032332d31322d32362032313a30333a3234, NULL, NULL),
(59, 'undefined', 'undefined', 'undefined', 'da39a3ee5e6b4b0d3255bfef95601890afd80709', 'undefined', 'undefined', 'undefined', 1, NULL, 0x323032332d31322d32372030303a34313a3033, NULL, NULL),
(60, 'Hayssa Gomes', 'issagomes2002+yt@gmail.com', '455', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '81993852292', 'Paratibe rua Madri N19', '654', 1, NULL, 0x323032342d30312d31312030333a31393a3137, NULL, NULL),
(61, 'Hayssa Gomes', 'issagomes32002@gmail.com', ' v', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '81993852292', 'Paratibe rua Madri N19', 'fdc', 1, NULL, 0x323032342d30312d31312030333a31393a3538, NULL, NULL),
(62, 'bv', 'issagomes2002+rrrr@gmail.com', 'b gfdvc', '6367c48dd193d56ea7b0baad25b19455e529f5ee', 'jhbgvfdc', 'bhgvfdcx', 'bv dcs', 1, NULL, 0x323032342d30312d31312031353a33303a3030, NULL, NULL),
(63, 'hayssa maria', 'issagomes2002+testee2@gmail.com', '13105628495', '6367c48dd193d56ea7b0baad25b19455e529f5ee', '839483249', 'rua madri numero 19', '13105628495', 1, NULL, 0x323032342d30322d30362031363a33353a3232, 0x323032342d30322d30362032313a33303a3131, 0x323032342d30322d30392031343a32343a3239);

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

--
-- Extraindo dados da tabela `checkouts`
--

INSERT INTO `checkouts` (`id`, `reference_id`, `type`, `value`, `status`, `transaction_id`, `product_id`, `user_id`, `created_at`) VALUES
(74, '207d3dc1-78bb-44fb-97c4-7e2bc64b8372', 'deposit', 230.30, 'PAID', 'CHEC_C399E6F9-4E7C-4ADE-AA06-1166EBE05905', NULL, 10, 0x323032332d31312d32372030313a30363a3239),
(72, 'c365ab09-63ab-4f6f-b8e5-9f6f7027420e', 'subscription', 97.00, 'PAID', 'CHEC_557ABC1F-D3BC-45C5-B8D4-F482A10CA984', 1, 10, 0x323032332d31312d32372030303a35383a3339),
(73, 'b15540f3-767f-41c9-a103-b2ec252c01e9', 'deposit', 63.70, 'PAID', 'CHEC_349DAE32-2166-49D7-B119-CA20E4566C3E', NULL, 10, 0x323032332d31312d32372030313a30313a3030),
(75, 'afa14d4f-f047-4e26-a0b7-34dab4bb9704', 'deposit', 544.50, 'DECLINED', 'CHEC_8D220F4E-444D-438F-BAAC-322F04C4CC59', NULL, 10, 0x323032332d31312d32372030313a30393a3432),
(76, 'c71aa675-c28e-4b24-9692-ef862a4a4fac', 'deposit', 654.54, 'PENDING', 'CHEC_F7DEDB15-EF5A-4008-978D-9D13B06EE415', NULL, 10, 0x323032332d31312d32372031383a34383a3130),
(77, '19e2fde5-60c2-4800-8735-7ae4545e35d3', 'subscription', 97.00, 'PAID', 'CHEC_F117F1ED-E97B-48CE-BF38-231F5C750A74', 1, 49, 0x323032332d31312d32382030363a32323a3430),
(81, 'ef57a296-a2fd-41e4-b0e6-8d4620a1eb29', 'subscription', 197.00, 'PAID', 'CHEC_17553137-5523-4951-BF6D-372EB622E4BB', 2, 48, 0x323032332d31312d32382030373a30303a3438),
(80, '7ced08ba-7461-46de-95fd-b88691c221c9', 'deposit', 93.40, 'PAID', 'CHEC_8ACD8A8C-0A7A-488A-A851-0D3C8F540F80', NULL, 49, 0x323032332d31312d32382030363a35363a3339),
(82, 'be078a03-7ab6-4fe5-a31f-9f5b49e11b7c', 'subscription', 97.00, 'PAID', 'CHEC_0C6AD75D-A698-4517-9C0E-40AB2F9CB9CB', 1, 48, 0x323032332d31312d32382030373a30333a3032),
(83, 'c3c45930-c15c-440c-a0c6-1019042c8d9d', 'subscription', 97.00, 'PAID', 'CHEC_4F4B9F4C-63D8-4E79-8771-3235921C6EB2', 1, 50, 0x323032332d31312d32382030373a30393a3539),
(84, '4fe0ea7b-1862-48e1-bdc5-6b9eb75aed66', 'subscription', 97.00, 'PAID', 'CHEC_F2D8C8F8-BBB6-4628-9A77-0543A09D7021', 1, 48, 0x323032332d31312d32382030373a32343a3233),
(85, '7b106bd9-2fd3-4a25-9a09-f1bf2d2372f7', 'subscription', 197.00, 'PENDING', 'CHEC_178E8504-5D8F-4180-BB91-8723D97771E0', 2, 48, 0x323032332d31312d32382030373a32373a3232),
(86, '14f3fe89-633b-4dd4-b685-3a45b694fac7', 'subscription', 97.00, 'PAID', 'CHEC_C2A612F3-BF3F-4AF5-B6D8-B0083ED788CC', 1, 48, 0x323032332d31312d32382030373a33393a3438),
(87, 'cd232703-9cab-4035-a447-d5e91679a395', 'deposit', 100.00, 'PAID', 'CHEC_FB3797BD-C9DA-4257-87CE-5242C73B6F94', NULL, 48, 0x323032332d31312d32382030373a34313a3033),
(88, 'd2d84f25-76ad-454e-a491-ba24d834fff1', 'subscription', 97.00, 'PAID', 'CHEC_6F48D941-CEEF-4DB8-92F9-6065D645D592', 1, 48, 0x323032332d31312d32382030373a34353a3236),
(89, 'bb245884-41c4-4983-9ee8-9b67e53686a7', 'deposit', 100.00, 'PAID', 'CHEC_F4893C72-6805-4311-960A-A7BEA96739A1', NULL, 48, 0x323032332d31312d32382030373a35313a3135),
(90, 'c7de0649-59f7-4449-b11f-3b0cc67cd0f0', 'subscription', 97.00, 'PENDING', 'CHEC_87136540-F9DE-4B90-BA47-1D1728CA90BE', 1, 10, 0x323032332d31322d30312030323a30333a3537),
(91, '2ff43dc3-92fb-40ea-8dda-0727ef41f2a1', 'deposit', 14.12, 'PENDING', 'CHEC_E6DFC424-CFA6-4803-8C51-A13E7654C93F', NULL, 10, 0x323032332d31322d30352030313a35363a3030),
(92, 'eaecf8e0-1567-4518-a855-9b2d9e8c83ed', 'subscription', 97.00, 'PENDING', 'CHEC_4AB1344F-D180-47DE-8E76-CDF726D571A1', 1, 10, 0x323032332d31322d30352030313a35373a3439),
(93, '512b6b77-27b5-474c-b9ad-9491fc4162db', 'subscription', 97.00, 'PAID', 'CHEC_D037DE0C-5963-40A4-9B2B-738DCAAB3EF4', 1, 10, 0x323032332d31322d31332031313a33303a3039),
(94, 'ce9a5c76-80ff-4b71-b45d-25aaf82c7168', 'deposit', 100.00, 'PAID', 'CHEC_A2CA66FB-25D6-4AB9-8B2F-8E870EB19A6B', 0, 10, 0x323032332d31322d31332031313a33353a3437),
(95, 'd3d7891d-dbb0-49d1-8780-9759261378b6', 'subscription', 97.00, 'PENDING', 'CHEC_98C28070-4346-4154-80CB-A857D1F2D418', 1, 10, 0x323032332d31322d31332031313a33393a3533),
(96, '5132e808-82d2-4bc2-9716-8a8ec31cd4e2', 'subscription', 97.00, 'PAID', 'CHEC_194D48D4-DE99-43BF-B07D-D117C9DC2C0B', 1, 10, 0x323032332d31322d31332031313a34303a3130),
(97, 'a70757d8-2914-4db8-bca8-5741f775dcfc', 'subscription', 97.00, 'PAID', 'CHEC_0A81A939-A691-44D8-938D-6AE102D53638', 1, 10, 0x323032332d31322d31332031333a31393a3033),
(98, 'ad273f31-ad40-4e31-b4c5-d010859bef8c', 'deposit', 1.00, 'PENDING', 'undefined', 0, 10, 0x323032342d30312d31322031353a30353a3130),
(99, '37a84bd2-edaf-4af3-b141-92e8b42f7e9d', 'deposit', 1.00, 'PENDING', NULL, 0, 10, 0x323032342d30312d31322031353a30383a3435),
(100, '59cd4d58-a33b-416b-a3e8-3b5d47262a69', 'deposit', 90.00, 'PENDING', 'undefined', 0, 10, 0x323032342d30312d31322031353a35303a3431),
(101, 'b9df7dc5-5920-4f81-afb0-cd932d598d00', 'deposit', 90.00, 'PENDING', 'undefined', 0, 10, 0x323032342d30312d31322031353a35353a3136),
(102, '405f80df-076a-4fab-8ac5-441afc01fdd6', 'deposit', 90.00, 'PENDING', NULL, 0, 10, 0x323032342d30312d31322031353a35353a3530),
(103, '18eef60e-c581-4edb-a187-4f34c0cb47ef', 'deposit', 90.00, 'PENDING', NULL, 0, 10, 0x323032342d30312d31322031353a35383a3330),
(104, '2bf02853-df9e-4dc0-bf80-99b21316468d', 'deposit', 90.00, 'PENDING', NULL, 0, 10, 0x323032342d30312d31322031363a30323a3336),
(105, 'fe0cfd9c-a84f-4fe7-a86e-5c7ec45aef5e', 'deposit', 1.00, 'PENDING', NULL, 0, 10, 0x323032342d30312d31322031363a30343a3330),
(106, 'c7daabf6-97cf-4b11-802e-59a145de8d1d', 'subscription', 97.00, 'PENDING', 'CHEC_B50C9D38-FEC6-4EF8-B26C-D6765BB9E416', 1, 63, 0x323032342d30322d30362032313a34383a3037),
(107, '75c79e03-9245-4b65-9e3b-7444cee90568', 'subscription', 97.00, 'PAID', 'CHEC_AC585912-4F67-4BD3-86E6-4974729A0E56', 1, 63, 0x323032342d30322d30362032323a30303a3330),
(108, 'ffd37830-d00a-408f-bb26-0a55c152b63f', 'deposit', 100.54, 'PAID', 'CHEC_AB67EC28-DB76-44E5-BCB1-4A704ACC3D22', 0, 63, 0x323032342d30322d30362032323a30373a3032);

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
(13, 10, 33, '1', 0),
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
(25, 10, 44, '1', 1),
(26, 25, 45, '1', 1),
(27, 24, 23, '2', 1),
(28, 23, 45, '3', 1),
(29, 25, 46, '1', 1),
(30, 24, 46, '2', 1),
(31, 23, 46, '3', 1),
(32, 48, 49, '1', 1),
(33, 48, 50, '1', 1),
(34, 10, 51, '1', 0);

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
(2, 'silver', '  🥈Smart silver (até 6% ao mês) – R$ 197,00\n\n  Bônus de ADESÃO (Ilimitado)\n  ╔═════════╗\n  ║ Nível 1- 33%  \n  ║ Nível 2- 8%     ╠ 45% 💵\n  ║ Nível 3- 4% \n  ╚═════════╝\n  \n  Bônus de RENTABILIDADE (até 3 afiliados por nível)\n  ╔═════════════════╗\n  ║ Nível 1- (3,33% * 3) = 9%  \n  ║ Nível 2- (2,33% * 3) = 7%     ╠ 20% 💵\n  ║ Nível 3- (1,33% * 3) = 4%   \n  ╚═════════════════╝', 197.00, 6.00, 'auto'),
(3, 'gold', '  🥇Smart gold (até 8% ao mês) – R$ 297,00\n\n  Bônus de ADESÃO (Ilimitado)\n  ╔═════════╗\n  ║ Nível 1 - 35%  \n  ║ Nível 2 - 10%  ╠ 50% 💵\n  ║ Nível 3 - 5%  \n  ╚═════════╝\n  \n  Bônus de RENTABILIDADE (até 3 afiliados por nível)\n  ╔═════════════════╗\n  ║ Nível 1- (4,00% * 3) = 12%  \n  ║ Nível 2- (2,66% * 3) = 8%     ╠ 25% 💵\n  ║ Nível 3- (1,66% * 3) = 5%   \n  ╚═════════════════╝', 297.00, 8.00, 'auto'),
(4, '🤖 Smart Bot', '  🤖 Smart Bot – R$197,00 (MENSAL)\n  Smart Bot – R$1.297,00 (VITALÍCIO)\n  • Gerenciamento avançado.\n  • Analisa mais de 17 estratégias e\n  encontra as melhores oportunidades.\n  • Operações automatizadas.\n  • Opera no mercado aberto e OTC.\n  • Stop WIN/LOSS.\n  • Martin Gale e Soros.\n  • Mais de 90% de assertividade.', 0.00, 0.00, 'manual'),
(5, '🎰 Alavancagem de banca', '  🎰 Alavancagem de banca:\n  \n  Aumente em até 5 vezes o valor de sua\n  banca em uma sessão individual com um\n  Trader de nossa equipe.\n\n  *Embora nossa Equipe tenha um\n  histórico de êxito nas operações,\n  o mercado de renda variável não\n  possibilita garantias que ganhos\n  passados representarão resultados\n  futuros.', 0.00, 0.00, 'manual');

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

--
-- Extraindo dados da tabela `product_earnings`
--

INSERT INTO `product_earnings` (`id`, `product_id`, `level`, `type`, `percentage`) VALUES
(1, 1, '1', 'subscription', 30.00),
(2, 1, '2', 'subscription', 7.00),
(3, 1, '3', 'subscription', 3.00),
(4, 1, '1', 'earnings', 2.33),
(5, 1, '2', 'earnings', 1.66),
(6, 1, '3', 'earnings', 1.00),
(7, 2, '1', 'subscription', 33.00),
(8, 2, '2', 'subscription', 8.00),
(9, 2, '3', 'subscription', 4.00),
(10, 2, '1', 'earnings', 3.33),
(11, 2, '2', 'earnings', 2.33),
(12, 2, '3', 'earnings', 1.33),
(13, 3, '1', 'subscription', 35.00),
(14, 3, '2', 'subscription', 10.00),
(15, 3, '3', 'subscription', 5.00),
(16, 3, '1', 'earnings', 4.00),
(17, 3, '2', 'earnings', 2.66),
(18, 3, '3', 'earnings', 1.66);

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

--
-- Extraindo dados da tabela `requests`
--

INSERT INTO `requests` (`id`, `type`, `subject`, `is_read`, `user_id`, `telegram_user_id`, `created_at`) VALUES
(1, 'service', '4', 0, 10, 1743885934, 0x323032332d31312d32372030313a34343a3036),
(5, 'support', 'gfds', 1, 10, 1743885934, 0x323032332d31312d32372030323a30393a3039),
(3, 'support', 'estou com problemas para realizar saques', 0, 10, 1743885934, 0x323032332d31312d32372030323a30343a3131),
(4, 'support', '<p>Lorem ipsum dolor sit amet. Non consequatur animi et ipsa maiores ut neque beatae vel laboriosam velit sit explicabo omnis ut omnis assumenda. In quae tenetur qui alias molestiae ut galisum esse quo aspernatur mollitia in dolorum nisi aut neque vitae ea magni voluptas. Quo impedit molestiae 33 corporis voluptatum ut provident eligendi et suscipit quisquam est dolorem corporis ut dolorem nihil! In quas corrupti vel velit odio qui dolor incidunt et necessitatibus quasi ut inventore sapiente sit reiciendis sapiente aut quae blanditiis. </p><p>Ut deleniti atque eos corporis soluta et magni enim aut dicta ullam ut odio doloremque qui exercitationem odit quo dignissimos voluptate. Est modi sequi est illo animi et dolor doloribus aut omnis libero ut quia doloribus. Est voluptatem quia sed dolorum itaque vel consequuntur magnam. Rem perferendis delectus aut suscipit molestiae sit nesciunt alias et iusto optio id voluptatem facere sit inventore suscipit non illum ducimus. </p><p>Ea ipsam consequatur et minima repellat in voluptate eligendi. Et quae consequatur ab sunt nisi et enim explicabo! Eos voluptas expedita qui placeat perspiciatis ut nulla voluptatem non cumque quibusdam sed possimus nostrum vel laudantium vero ex eius harum. Ea laborum molestiae a illo quia id incidunt illum in voluptatum animi. </p>\n', 1, 10, 1743885934, 0x323032332d31312d32372030323a30343a3536),
(6, 'support', 'gvfcdxs', 1, 10, 1743885934, 0x323032332d31312d32372030323a30393a3338),
(7, 'support', 'vfcdxs', 1, 10, 1743885934, 0x323032332d31312d32372030323a30393a3430),
(8, 'support', 'vcxz', 1, 10, 1743885934, 0x323032332d31312d32372030323a31313a3031),
(10, 'service', '4', 1, 48, 1743885934, 0x323032332d31312d32382030373a32333a3133),
(11, 'service', '4', 1, 48, 1743885934, 0x323032332d31312d32382030373a34343a3231),
(12, 'support', 'meu saque do dia 28/11 as 04:50 da manha no valor de 100 reais foi negado, mesmo tendo saldo suficiente', 1, 10, 1743885934, 0x323032332d31312d32382030373a35363a3230),
(13, 'service', '4', 1, 10, 1743885934, 0x323032332d31322d30312030323a30333a3334),
(14, 'support', 'Nao consigo realizar saque, fica em pendencia sempre', 1, 10, 1743885934, 0x323032332d31322d30312030323a31383a3531),
(15, 'service', '4', 0, 10, 1743885934, 0x323032332d31322d31332030373a35343a3030),
(16, 'service', '5', 0, 10, 1743885934, 0x323032332d31322d31332030373a35363a3238);

-- --------------------------------------------------------

--
-- Estrutura da tabela `roles`
--

CREATE TABLE `roles` (
  `id` bigint(20) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

--
-- Extraindo dados da tabela `roles`
--

INSERT INTO `roles` (`id`, `name`, `created_at`) VALUES
(1, 'admin', 0x323032332d31322d30372030333a32353a3537),
(2, 'manager', 0x323032332d31322d30372030333a32353a3537);

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
(1, 'hayssa', 'gomes', 'admin@mail.com', '6367c48dd193d56ea7b0baad25b19455e529f5ee', 1, 0x323032332d31322d30372030333a32343a3236);

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

--
-- Extraindo dados da tabela `users_plans`
--

INSERT INTO `users_plans` (`id`, `user_id`, `product_id`, `status`, `acquired_in`, `expired_in`) VALUES
(9, 25, 1, 1, 0x323032332d31312d32372030303a35393a3333, 0x323032332d31322d32372030303a35393a3333),
(10, 49, 2, 1, 0x323032332d31312d32382030363a32333a3437, 0x323032332d31322d32382030363a32333a3437),
(11, 48, 1, 1, 0x323032332d31322d32382030373a34363a3537, 0x323032332d31322d32382030373a34363a3537),
(12, 50, 3, 1, 0x323032332d31312d32382030373a31313a3032, 0x323032332d31322d32382030373a31313a3032),
(13, 10, 1, 1, 0x323032332d31322d32372030393a33383a3030, 0x323032342d30312d32372030393a33383a3030),
(14, 23, 1, 1, 0x323032332d31312d32372030303a35393a3333, 0x323032332d31322d33302030393a30383a3234),
(15, 24, 2, 1, 0x323032332d31312d32382030363a32333a3437, 0x323032332d31322d33302030393a30393a3332),
(16, 63, 1, 1, 0x323032342d30322d30362032323a30323a3030, 0x323032342d30332d30362032323a30323a3030);

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

--
-- Extraindo dados da tabela `verification_email`
--

INSERT INTO `verification_email` (`id`, `user_id`, `token`, `status`) VALUES
(46, 59, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MDM2Mzc2NjMsImV4cCI6MTcwMzY0MTI2M30.1RORHQSIMwzT5qqgyc6qiu_CTKgIzv0vu-j6AAh5NTs', 'pending'),
(45, 58, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDIrMTNAZ21haWwuY29tIiwiaWF0IjoxNzAzNjI0NjA0LCJleHAiOjE3MDM2MjgyMDR9.RC1pqWmJtA1fwqPJHBzXwXD28arbI8JYXHgTyyVFAq0', 'pending'),
(44, 57, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDIrMndAZ21haWwuY29tIiwiaWF0IjoxNzAzNjI0NDUwLCJleHAiOjE3MDM2MjgwNTB9.jPwzk7lERKVW0IjCnnM5CGxJDpaz0MVB3pnhfTO1kv8', 'pending'),
(43, 56, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InZkY3giLCJpYXQiOjE3MDM2MTk5NjQsImV4cCI6MTcwMzYyMzU2NH0.py3yOfpO9Az4unrQ8ydAz8R64pNgUKpfZTMeMptGDek', 'pending'),
(42, 55, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDIraGJ6akBnbWFpbC5jb20iLCJpYXQiOjE3MDM2MTc5NjksImV4cCI6MTcwMzYyMTU2OX0.vFDWc1L220TQ4N3zW8eG60EKU2Fa3y6LAiH7oPqXbSE', 'pending'),
(41, 54, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDIrdHd0QGdtYWlsLmNvbSIsImlhdCI6MTcwMzYxNDg3NCwiZXhwIjoxNzAzNjE4NDc0fQ.tRi8MmhS6qIKP4SQ1aBzivoYBDYJ7je8eV2-i2raYxQ', 'pending'),
(40, 53, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDIrdHdAZ21haWwuY29tIiwiaWF0IjoxNzAzNTczMzAyLCJleHAiOjE3MDM1NzY5MDJ9.uCy15-qzWEwpzTwLREE_eevAeT3DxCCGHuMfbkSIIfo', 'pending'),
(39, 52, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDIrdEBnbWFpbC5jb20iLCJpYXQiOjE3MDM1NzMyNjIsImV4cCI6MTcwMzU3Njg2Mn0.l2bLjDS81nov9iULjTX1Jiq8fPU-hsOjlrbjLhQjdQA', 'pending'),
(37, 50, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImJ5aXNzYWcrdGVzdGUyQGdtYWlsLmNvbSIsImlhdCI6MTcwMTE1MjE4NywiZXhwIjoxNzAxMTU1Nzg3fQ.Sc5yhNBHkHmrUxPegoApR_eFyeWfjsz_MWjVjjesLHE', 'checked'),
(38, 51, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imd2ZmRjeCIsImlhdCI6MTcwMjQ2NDc4MSwiZXhwIjoxNzAyNDY4MzgxfQ.yOVlUOtTeToeBwE7Z-0BrR7accS8ztrszL3B6qR3sAM', 'pending'),
(36, 49, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImJ5aXNzYWcrdGVzdGUxQGdtYWlsLmNvbSIsImlhdCI6MTcwMTE1MjA4MCwiZXhwIjoxNzAxMTU1NjgwfQ.B3A6h3F0XWGcPhu9MNviv_ZYVtcmoJko0kcz3kCecdc', 'checked'),
(35, 48, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImJ5aXNzYWdAZ21haWwuY29tIiwiaWF0IjoxNzAxMTUxODkyLCJleHAiOjE3MDExNTU0OTJ9.9FjnI3q7wCEsoSNEBSBY6psnM0pLd1xYhhz9b8tHh2g', 'checked'),
(34, 48, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImJ5aXNzYWdAZ21haWwuY29tIiwiaWF0IjoxNzAxMTUxODY1LCJleHAiOjE3MDExNTU0NjV9.pJI-5tcbvk7MsARAk8VVIxgTy6t14bAi7BTHr0avPYQ', 'checked'),
(33, 47, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImJ5aXNzYWdAZ21haWwuY29tIiwiaWF0IjoxNzAxMTUxNjQwLCJleHAiOjE3MDExNTUyNDB9.w5PfUdV2T1-o07WB8KAkgB1mxKd1yIbPzs1X3-FZ0VY', 'checked'),
(47, 60, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDIreXRAZ21haWwuY29tIiwiaWF0IjoxNzA0OTQzMTU3LCJleHAiOjE3MDQ5NDY3NTd9.PWgqCr0RlYiuwC_RBcPjZ1kHQRvnarvVcFe_gF3D_ns', 'pending'),
(48, 61, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczMyMDAyQGdtYWlsLmNvbSIsImlhdCI6MTcwNDk0MzE5OCwiZXhwIjoxNzA0OTQ2Nzk4fQ.zdhWiLzFy4pGk5MgeoqeHAnyuMDJs3FnG8t4uPoZX3c', 'pending'),
(49, 62, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDIrcnJyckBnbWFpbC5jb20iLCJpYXQiOjE3MDQ5ODcwMDAsImV4cCI6MTcwNDk5MDYwMH0.L2kB6C9tyO_UreSuz4W4nFxbiYH57hcot7msSpfU6x0', 'pending'),
(50, 10, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDJAZ21haWwuY29tIiwiaWF0IjoxNzA0OTg3MjI4LCJleHAiOjE3MDQ5OTA4Mjh9.AilIAb86b8yVYXl6cbwGSWh2B7moS-JDKULaJn9dUrg', 'pending'),
(51, 10, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDJAZ21haWwuY29tIiwiaWF0IjoxNzA0OTg3MjczLCJleHAiOjE3MDQ5OTA4NzN9.-sZZDCpw_uttn1DvkG2z5T1YjlC7y-8j5XbTK-NqDkI', 'pending'),
(52, 10, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDJAZ21haWwuY29tIiwiaWF0IjoxNzA0OTg3MjgxLCJleHAiOjE3MDQ5OTA4ODF9.Nb-q8tGwf28-jV1h2def25bRe-XR_LWHdSGTm4RkoM0', 'pending'),
(53, 10, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDJAZ21haWwuY29tIiwiaWF0IjoxNzA0OTg3NzMxLCJleHAiOjE3MDQ5OTEzMzF9.a8pRpVMfMNTRjucGvoGnx2DkgWEu0aw1gZIG1SvcY5Q', 'pending'),
(54, 63, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDIrdGVzdGVlMkBnbWFpbC5jb20iLCJpYXQiOjE3MDcyMzczMjIsImV4cCI6MTcwNzI0MDkyMn0.OIxwrek0ZwG30E4QZ128PsNBSzmv2lgTILUL4DZOcPE', 'checked'),
(55, 63, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDIrdGVzdGVlMkBnbWFpbC5jb20iLCJpYXQiOjE3MDcyMzk3ODcsImV4cCI6MTcwNzI0MzM4N30.1o1KN73zghRiuT_PkAJRWU6XEZGVd77Oa5SAfU1Yqxo', 'checked'),
(56, 63, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDIrdGVzdGVlMkBnbWFpbC5jb20iLCJpYXQiOjE3MDcyNDIwMzcsImV4cCI6MTcwNzI0NTYzN30.1G5nw89fIm-LXHkgxavhSeXpGDcFH7JuJpIbnE7G-Ks', 'checked'),
(57, 63, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDIrdGVzdGVlMkBnbWFpbC5jb20iLCJpYXQiOjE3MDcyNDIwODEsImV4cCI6MTcwNzI0NTY4MX0.RldQle8yWMh2Kz5gYtAfdiAMx8MiR2p-1aPcg82xkw8', 'checked'),
(58, 63, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDIrdGVzdGVlMkBnbWFpbC5jb20iLCJpYXQiOjE3MDcyNDIxNTAsImV4cCI6MTcwNzI0NTc1MH0.QdEyGPW3hoVtkcFGSpWyv7Q0-XNxQx0ca_kzA6_U1cU', 'checked'),
(59, 63, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDIrdGVzdGVlMkBnbWFpbC5jb20iLCJpYXQiOjE3MDcyNDI0ODksImV4cCI6MTcwNzI0NjA4OX0.w6CL00AXoBlCsNVw3FR8YNlL7Skw4z-ALd4LV5WSSSI', 'checked'),
(60, 63, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDIrdGVzdGVlMkBnbWFpbC5jb20iLCJpYXQiOjE3MDcyNDI2MzIsImV4cCI6MTcwNzI0NjIzMn0.6T8bzqSKLH4OHEIcKStAloYcqFWXFa6bnHPLc-O9NW0', 'checked'),
(61, 63, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDIrdGVzdGVlMkBnbWFpbC5jb20iLCJpYXQiOjE3MDcyNTE2MTgsImV4cCI6MTcwNzI1NTIxOH0.2aOsM9N1YgbzDjjbXyyyIVYQvkJGZlzQYK12Xb8Uazc', 'checked'),
(62, 63, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Imlzc2Fnb21lczIwMDIrdGVzdGVlMkBnbWFpbC5jb20iLCJpYXQiOjE3MDcyNTQ2NjMsImV4cCI6MTcwNzI1ODI2M30.CzSGF_cfnq8ifX4k35RpZjgbIEMjrjvpihnoQ9p3quw', 'checked');

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
  `error_message` varchar(255) DEFAULT NULL,
  `reference_id` varchar(255) NOT NULL,
  `transaction_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

--
-- Extraindo dados da tabela `withdrawals`
--

INSERT INTO `withdrawals` (`id`, `user_id`, `value`, `status`, `reply_observation`, `error_message`, `reference_id`, `transaction_id`, `created_at`) VALUES
(4, 10, 17.12, 'authorized', 'okk', NULL, '1bed10a3-ca1e-44e5-a54a-7b52336ddfb7', NULL, 0x323032332d31312d32372032313a33383a3033),
(6, 10, 100.00, 'refused', '', NULL, '553cc5e9-b9b3-416d-bbbd-6ce6399c888a', NULL, 0x323032332d31312d32382030373a35303a3235),
(7, 10, 100.00, 'authorized', 'não autorizar mais', NULL, '1bed10a3-ca1e-44e5-a54a-7b52336ddfb7', NULL, 0x323032332d31312d32372032313a33383a3033),
(10, 10, 120.00, 'refused', 'rejeitei por x motivo', NULL, '12b17df7-9f37-41de-988c-3f2ce9f43ef6', NULL, 0x323032332d31322d31332031343a33313a3439),
(11, 10, 120.00, 'refused', '', NULL, 'a4af7b08-8890-47e3-b209-dfcf4f80db04', NULL, 0x323032332d31322d31332031343a33323a3430),
(12, 63, 100.00, 'success', '', NULL, '92c7d190-8076-43c7-bb86-17829ed5b90b', NULL, 0x323032342d30322d30362032323a33303a3339),
(13, 10, 300.00, 'pending', NULL, NULL, '0f3509ea-9e1b-422c-b3d8-175e46c83798', NULL, 0x323032342d30322d30392031343a33353a3531);

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
-- Índices para tabela `roles`
--
ALTER TABLE `roles`
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
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=60;

--
-- AUTO_INCREMENT de tabela `bot_users`
--
ALTER TABLE `bot_users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=64;

--
-- AUTO_INCREMENT de tabela `checkouts`
--
ALTER TABLE `checkouts`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=109;

--
-- AUTO_INCREMENT de tabela `network`
--
ALTER TABLE `network`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT de tabela `products`
--
ALTER TABLE `products`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de tabela `product_earnings`
--
ALTER TABLE `product_earnings`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT de tabela `requests`
--
ALTER TABLE `requests`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT de tabela `roles`
--
ALTER TABLE `roles`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de tabela `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de tabela `users_plans`
--
ALTER TABLE `users_plans`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT de tabela `verification_email`
--
ALTER TABLE `verification_email`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=63;

--
-- AUTO_INCREMENT de tabela `withdrawals`
--
ALTER TABLE `withdrawals`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
