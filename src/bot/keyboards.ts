import TelegramBot from "node-telegram-bot-api";

function row(...labels: string[]): TelegramBot.KeyboardButton[] {
  return labels.map((text) => ({ text }));
}

export function inlineKeyboard(buttons: TelegramBot.InlineKeyboardButton[]): TelegramBot.SendMessageOptions {
  return { reply_markup: { inline_keyboard: [buttons] } };
}

export const authMenuKeyboard: TelegramBot.ReplyKeyboardMarkup = {
  keyboard: [row("📲LOGIN", "🆕 CADASTRO")],
  one_time_keyboard: false,
};

export const mainMenuKeyboard: TelegramBot.ReplyKeyboardMarkup = {
  keyboard: [
    row("🎯 PRODUTOS E SERVIÇOS"),
    row("🪪 CADASTRO", "🔗 LINK DE AFILIADO"),
    row("🚻 REDE", "💲FINANCEIRO"),
    row("📃 DÚVIDAS GERAIS"),
    row("📱 ATENDIMENTO AO CLIENTE"),
    row("🔚SAIR DA CONTA"),
  ],
  one_time_keyboard: false,
};

export const financialMenuKeyboard: TelegramBot.ReplyKeyboardMarkup = {
  keyboard: [
    row("➕💵 DEPÓSITO", "➖💵 SAQUE"),
    row("💲🔄 TRANSFERIR SALDO"),
    row("💰 SALDO", "🧾 EXTRATO"),
    row("📥 SOLICITAÇÕES DE DEPÓSITO", "📤 SOLICITAÇÕES DE SAQUE"),
    row("🛒 SOLICITAÇÕES DE ADESÃO"),
    row("🔄 VOLTAR AO MENU PRINCIPAL"),
  ],
  one_time_keyboard: false,
};

export function backToMainMenuKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return { keyboard: [row("🔄 VOLTAR AO MENU PRINCIPAL")], one_time_keyboard: false };
}

export function backToFinancialMenuKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return { keyboard: [row("🔄 VOLTAR AO MENU FINANCEIRO")], one_time_keyboard: false };
}

export function backToAuthMenuKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return { keyboard: [row("🔄 VOLTAR")], one_time_keyboard: false };
}

export const BACK_TO_MAIN_MENU = "🔄 VOLTAR AO MENU PRINCIPAL";
export const BACK_TO_FINANCIAL_MENU = "🔄 VOLTAR AO MENU FINANCEIRO";
export const BACK = "🔄 VOLTAR";
