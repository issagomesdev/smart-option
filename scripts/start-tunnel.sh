#!/usr/bin/env bash
# npm run tunnel — sobe só o túnel Cloudflare (nomeado, persistente) para a
# API. Útil quando a API já está rodando em outro terminal/container.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

require_env_file

if ! check_cloudflared_installed; then
  print_cloudflared_install_instructions
  exit 1
fi

if ! check_cloudflared_logged_in; then
  fail "cloudflared instalado, mas você ainda não autenticou esta máquina."
  log "Rode: cloudflared tunnel login"
  log "(abre o navegador — escolha a zona byissa.dev quando solicitado)"
  exit 1
fi

ensure_tunnel || exit 1

APP_PORT="$(env_get APP_PORT "3000")"

log "\n════════════════════════════════════════════════════════════════"
ok "Cloudflare Tunnel configurado"
log "\nEncaminhando:\n\n  https://${CF_RUNTIME_DOMAIN}\n  → http://$(env_get CF_TUNNEL_HOST localhost):${APP_PORT}"
log "\nWebhook URL:\n\n  https://${CF_RUNTIME_DOMAIN}/api/webhooks/asaas\n"
log "Cadastre a URL do webhook acima no painel Sandbox da Asaas. Pressione Ctrl+C para encerrar o túnel."
log "════════════════════════════════════════════════════════════════\n"

exec cloudflared tunnel --config "$CF_RUNTIME_CONFIG" run
