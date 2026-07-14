# npm run tunnel -- sobe so o tunel Cloudflare (nomeado, persistente) para a
# API. Util quando a API ja esta rodando em outro terminal/container.
# Apenas ASCII neste arquivo de proposito (ver lib.ps1).

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

Assert-EnvFile

if (-not (Test-CloudflaredInstalled)) {
    Show-CloudflaredInstallInstructions
    exit 1
}

if (-not (Test-CloudflaredLoggedIn)) {
    Write-Fail "cloudflared instalado, mas voce ainda nao autenticou esta maquina."
    Write-Host "Rode: cloudflared tunnel login"
    Write-Host "(abre o navegador -- escolha a zona byissa.dev quando solicitado)"
    exit 1
}

$tunnel = Confirm-Tunnel
if (-not $tunnel) { exit 1 }

$appPort = Get-EnvValue -Key "APP_PORT" -Default "3000"
$cfHost = Get-EnvValue -Key "CF_TUNNEL_HOST" -Default "localhost"

Write-Host " "
Write-Host "===================================================================="
Write-Ok "Cloudflare Tunnel configurado"
Write-Host " "
Write-Host "Encaminhando:"
Write-Host " "
Write-Host "  https://$($tunnel.Domain)"
Write-Host "  -> http://${cfHost}:${appPort}"
Write-Host " "
Write-Host "Webhook URL:"
Write-Host " "
Write-Host "  https://$($tunnel.Domain)/api/webhooks/asaas"
Write-Host " "
Write-Host "Cadastre a URL do webhook acima no painel Sandbox da Asaas. Pressione Ctrl+C para encerrar o tunel."
Write-Host "===================================================================="
Write-Host " "

& cloudflared tunnel --config $tunnel.ConfigPath run
