#!/usr/bin/env bash
# npm run dev:full — Docker (API + banco + cache) + Cloudflare Tunnel, com
# validação de /health e /api/webhooks/asaas, tudo num único comando.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

COMPOSE_FILE="$ROOT_DIR/docker-compose.dev.yml"
TUNNEL_PID=""

cleanup() {
  log "\nEncerrando ambiente de desenvolvimento..."
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null
  exit 0
}
trap cleanup INT TERM

require_env_file

step "Verificando Docker..."
check_docker || exit 1
ok "Docker disponível"

step "Subindo API + MySQL + Redis (docker-compose.dev.yml)..."
if ! docker compose -f "$COMPOSE_FILE" up -d; then
  fail "Falha ao subir os containers. Veja o log do Docker Compose acima."
  exit 1
fi

step "Aguardando os containers ficarem saudáveis..."
waited=0
while [ "$waited" -lt 90 ]; do
  mysql_status="$(docker inspect --format='{{.State.Health.Status}}' smart-option-dev-mysql-1 2>/dev/null || echo "")"
  redis_status="$(docker inspect --format='{{.State.Health.Status}}' smart-option-dev-redis-1 2>/dev/null || echo "")"
  if [ "$mysql_status" = "healthy" ] && [ "$redis_status" = "healthy" ]; then
    break
  fi
  sleep 2
  waited=$((waited + 2))
done
if [ "$mysql_status" != "healthy" ] || [ "$redis_status" != "healthy" ]; then
  fail "MySQL/Redis não ficaram healthy a tempo."
  exit 1
fi
ok "MySQL e Redis healthy"

APP_PORT="$(env_get APP_PORT "3000")"
step "Aguardando a API responder em /health..."
if wait_for_http "http://localhost:${APP_PORT}/health" 60; then
  ok "API respondendo em http://localhost:${APP_PORT}"
else
  fail "A API não respondeu em /health a tempo. Veja os logs com: docker compose -f docker-compose.dev.yml logs app"
  exit 1
fi

step "Configurando Cloudflare Tunnel..."
if ! check_cloudflared_installed; then
  print_cloudflared_install_instructions
  warn "A API e o banco continuam rodando — encerre com Ctrl+C ou \`npm run docker:down\` quando terminar."
  wait
  exit 1
fi

if ! check_cloudflared_logged_in; then
  fail "cloudflared instalado, mas esta máquina ainda não autenticou (cloudflared tunnel login)."
  warn "A API e o banco continuam rodando — encerre com Ctrl+C ou \`npm run docker:down\` quando terminar."
  wait
  exit 1
fi

ensure_tunnel || { warn "A API e o banco continuam rodando."; exit 1; }
ok "Túnel configurado (${CF_RUNTIME_DOMAIN})"

cloudflared tunnel --config "$CF_RUNTIME_CONFIG" run &
TUNNEL_PID=$!

step "Aguardando o túnel público ficar acessível..."
PUBLIC_URL="https://${CF_RUNTIME_DOMAIN}"
if wait_for_http "${PUBLIC_URL}/health" 30; then
  ok "Túnel funcionando — ${PUBLIC_URL} alcança a API local"
else
  warn "Não foi possível confirmar o túnel publicamente em 30s — DNS pode ainda estar propagando. Verifique manualmente em instantes."
fi

step "Validando /api/webhooks/asaas através do túnel..."
webhook_status="$(curl --silent --max-time 10 -o /dev/null -w "%{http_code}" -X POST -H "content-type: application/json" -d "{}" "${PUBLIC_URL}/api/webhooks/asaas" 2>/dev/null || echo "000")"
if [ "$webhook_status" != "000" ]; then
  ok "Endpoint de webhook respondeu (HTTP ${webhook_status} — esperado sem assinatura válida, prova que o túnel alcança a rota)"
else
  warn "Não foi possível alcançar o endpoint de webhook publicamente."
fi

cat <<EOF

========================================

Smart Option API

Running:

http://localhost:${APP_PORT}

Cloudflare Tunnel:

${PUBLIC_URL}

Webhook URL:

${PUBLIC_URL}/api/webhooks/asaas

========================================
EOF

log "Ambiente no ar. Pressione Ctrl+C para encerrar o túnel (o Docker continua rodando; use \"npm run docker:down\" para derrubá-lo)."
wait "$TUNNEL_PID"
