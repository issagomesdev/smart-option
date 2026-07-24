#!/usr/bin/env bash
# Funções compartilhadas por start-dev.sh e start-tunnel.sh.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

log()  { echo -e "$1"; }
step() { echo -e "\n▶ $1"; }
ok()   { echo -e "✅ $1"; }
fail() { echo -e "❌ $1" >&2; }
warn() { echo -e "⚠️  $1"; }

# Lê uma chave do .env sem dar `source` no arquivo inteiro (evita executar
# qualquer coisa que não seja uma atribuição simples KEY=valor).
env_get() {
  local key="$1"
  local default="${2:-}"
  if [ ! -f "$ENV_FILE" ]; then
    echo "$default"
    return
  fi
  local value
  value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d '=' -f2-)"
  if [ -z "$value" ]; then
    echo "$default"
  else
    echo "$value"
  fi
}

# Atualiza (ou adiciona, se ainda não existir) uma chave no .env.
env_set() {
  local key="$1"
  local value="$2"
  if [ ! -f "$ENV_FILE" ]; then
    fail ".env não encontrado em $ENV_FILE"
    return 1
  fi
  if grep -qE "^${key}=" "$ENV_FILE"; then
    # BSD sed (macOS) exige um argumento depois de -i; GNU sed (Linux/Git Bash) não.
    if sed --version >/dev/null 2>&1; then
      sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    else
      sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    fi
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

require_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    fail ".env não encontrado. Copie .env.development.example para .env e preencha os valores."
    exit 1
  fi
}

check_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    fail "Docker não encontrado no PATH. Instale/inicie o Docker Desktop: https://www.docker.com/products/docker-desktop/"
    return 1
  fi
  if ! docker version >/dev/null 2>&1; then
    fail "Docker instalado mas não respondendo — o Docker Desktop está aberto e rodando?"
    return 1
  fi
  return 0
}

check_cloudflared_installed() {
  command -v cloudflared >/dev/null 2>&1
}

print_cloudflared_install_instructions() {
  cat <<'EOF'

O cloudflared não foi encontrado no PATH. Instale com uma das opções abaixo e rode o comando de novo.

  Windows (Chocolatey):   choco install cloudflared
  Windows (Scoop):        scoop install cloudflared
  macOS (Homebrew):       brew install cloudflared
  Linux (deb/rpm/binário): https://pkg.cloudflare.com/index.html
  Qualquer sistema:        https://github.com/cloudflare/cloudflared/releases

Depois de instalar, autentique com a sua conta Cloudflare (abre o navegador,
escolha a zona "byissa.dev" quando solicitado):

  cloudflared tunnel login

Isso cria ~/.cloudflared/cert.pem — só precisa ser feito uma vez por máquina.
EOF
}

check_cloudflared_logged_in() {
  [ -f "$HOME/.cloudflared/cert.pem" ]
}

# Garante um túnel nomeado configurado (cria se ainda não existir) e devolve
# um config.runtime.yml pronto para `cloudflared tunnel run`. Nunca usa o
# modo `--url` (túnel efêmero, não permitido pelo escopo deste projeto).
ensure_tunnel() {
  local tunnel_name="smart-option-dev"
  local tunnel_id
  tunnel_id="$(env_get CF_TUNNEL_ID)"
  local domain
  domain="$(env_get CF_TUNNEL_DOMAIN)"
  local host
  host="$(env_get CF_TUNNEL_HOST "localhost")"
  local app_port
  app_port="$(env_get APP_PORT "3000")"

  mkdir -p "$ROOT_DIR/cloudflared/credentials"

  if [ -z "$tunnel_id" ]; then
    step "Nenhum CF_TUNNEL_ID configurado — criando um túnel nomeado (\"$tunnel_name\")..."
    local create_output
    create_output="$(cloudflared tunnel create "$tunnel_name" 2>&1)" || {
      fail "Falha ao criar o túnel. Saída do cloudflared:"
      echo "$create_output" >&2
      return 1
    }
    echo "$create_output"

    tunnel_id="$(echo "$create_output" | grep -oE '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' | head -n1)"
    if [ -z "$tunnel_id" ]; then
      fail "Não consegui identificar o ID do túnel criado na saída do cloudflared — crie manualmente e defina CF_TUNNEL_ID no .env."
      return 1
    fi

    # `cloudflared tunnel create` grava as credenciais em ~/.cloudflared/<id>.json
    # por padrão — copiamos para dentro do projeto para o config.yml ficar autocontido.
    local default_creds="$HOME/.cloudflared/${tunnel_id}.json"
    if [ -f "$default_creds" ]; then
      cp "$default_creds" "$ROOT_DIR/cloudflared/credentials/${tunnel_id}.json"
    fi

    env_set "CF_TUNNEL_ID" "$tunnel_id"
    ok "Túnel criado: $tunnel_id"
  else
    ok "Reaproveitando túnel existente: $tunnel_id"
    if [ ! -f "$ROOT_DIR/cloudflared/credentials/${tunnel_id}.json" ]; then
      local default_creds="$HOME/.cloudflared/${tunnel_id}.json"
      [ -f "$default_creds" ] && cp "$default_creds" "$ROOT_DIR/cloudflared/credentials/${tunnel_id}.json"
    fi
  fi

  # Roda sempre, mesmo reaproveitando um túnel existente — `route dns` é
  # idempotente (não falha se o CNAME já existir apontando pro mesmo túnel).
  # Sem isso, um CF_TUNNEL_ID já salvo mas cujo domínio mudou (ou cujo DNS
  # nunca foi criado de fato) fica com o túnel conectado à Cloudflare mas
  # inalcançável por fora — "Could not resolve host" no domínio público,
  # bug real encontrado ao verificar esta fase com o usuário.
  step "Garantindo registro DNS para $domain..."
  if cloudflared tunnel route dns "$tunnel_name" "$domain" 2>&1; then
    ok "DNS configurado: $domain → túnel $tunnel_name"
  else
    warn "Não foi possível confirmar/criar o registro DNS automaticamente (pode já existir apontando para outro túnel, ou a zona byissa.dev não está nesta conta). Verifique manualmente no painel Cloudflare > DNS."
  fi

  local runtime_config="$ROOT_DIR/cloudflared/config.runtime.yml"
  sed -e "s|{{CF_TUNNEL_ID}}|${tunnel_id}|g" \
      -e "s|{{CF_TUNNEL_DOMAIN}}|${domain}|g" \
      -e "s|{{CF_TUNNEL_HOST}}|${host}|g" \
      -e "s|{{APP_PORT}}|${app_port}|g" \
      "$ROOT_DIR/cloudflared/config.yml" > "$runtime_config"

  CF_RUNTIME_CONFIG="$runtime_config"
  CF_RUNTIME_DOMAIN="$domain"
}

wait_for_http() {
  local url="$1"
  local timeout_s="${2:-30}"
  local waited=0
  while [ "$waited" -lt "$timeout_s" ]; do
    if curl --silent --fail --max-time 3 -o /dev/null "$url"; then
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}
