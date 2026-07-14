# npm run dev:full -- Docker (API + banco + cache) + Cloudflare Tunnel, com
# validacao de /health e /api/webhooks/asaas, tudo num unico comando.
# Apenas ASCII neste arquivo de proposito (ver lib.ps1).

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

$ComposeFile = Join-Path $Script:RootDir "docker-compose.dev.yml"
$TunnelProcess = $null

try {
    Assert-EnvFile

    Write-Step "Verificando Docker..."
    if (-not (Test-DockerAvailable)) { exit 1 }
    Write-Ok "Docker disponivel"

    Write-Step "Subindo API + MySQL + Redis (docker-compose.dev.yml)..."
    docker compose -f $ComposeFile up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Falha ao subir os containers. Veja o log do Docker Compose acima."
        exit 1
    }

    Write-Step "Aguardando os containers ficarem saudaveis..."
    $deadline = (Get-Date).AddSeconds(90)
    $mysqlHealthy = $false
    $redisHealthy = $false
    while ((Get-Date) -lt $deadline) {
        $mysqlStatus = (docker inspect --format='{{.State.Health.Status}}' smart-option-dev-mysql-1 2>$null)
        $redisStatus = (docker inspect --format='{{.State.Health.Status}}' smart-option-dev-redis-1 2>$null)
        $mysqlHealthy = $mysqlStatus -eq "healthy"
        $redisHealthy = $redisStatus -eq "healthy"
        if ($mysqlHealthy -and $redisHealthy) { break }
        Start-Sleep -Seconds 2
    }
    if (-not ($mysqlHealthy -and $redisHealthy)) {
        Write-Fail "MySQL/Redis nao ficaram healthy a tempo."
        exit 1
    }
    Write-Ok "MySQL e Redis healthy"

    $appPort = Get-EnvValue -Key "APP_PORT" -Default "3000"
    Write-Step "Aguardando a API responder em /health..."
    if (Wait-ForHttp -Url "http://localhost:$appPort/health" -TimeoutSeconds 60) {
        Write-Ok "API respondendo em http://localhost:$appPort"
    } else {
        Write-Fail "A API nao respondeu em /health a tempo. Veja os logs com: docker compose -f docker-compose.dev.yml logs app"
        exit 1
    }

    Write-Step "Configurando Cloudflare Tunnel..."
    if (-not (Test-CloudflaredInstalled)) {
        Show-CloudflaredInstallInstructions
        Write-Warn 'A API e o banco continuam rodando -- encerre com Ctrl+C ou "npm run docker:down" quando terminar.'
        exit 1
    }
    if (-not (Test-CloudflaredLoggedIn)) {
        Write-Fail "cloudflared instalado, mas esta maquina ainda nao autenticou (cloudflared tunnel login)."
        Write-Warn 'A API e o banco continuam rodando -- encerre com Ctrl+C ou "npm run docker:down" quando terminar.'
        exit 1
    }

    $tunnel = Confirm-Tunnel
    if (-not $tunnel) {
        Write-Warn "A API e o banco continuam rodando."
        exit 1
    }
    Write-Ok "Tunel configurado ($($tunnel.Domain))"

    # "-ArgumentList" com um array NAO coloca aspas em elementos que tenham
    # espaco (ex.: "C:\Users\issa gomes\...") -- Start-Process junta o array
    # com espacos sem escapar nada, entao o caminho quebra no meio e o
    # cloudflared falha na hora tentando abrir um arquivo truncado. Passar
    # uma unica string, com o caminho entre aspas escapadas, resolve.
    $configPathQuoted = '"' + $tunnel.ConfigPath + '"'
    $TunnelProcess = Start-Process -FilePath "cloudflared" -ArgumentList "tunnel --config $configPathQuoted run" -NoNewWindow -PassThru

    Write-Step "Aguardando o tunel publico ficar acessivel..."
    $publicUrl = "https://$($tunnel.Domain)"
    if (Wait-ForHttp -Url "$publicUrl/health" -TimeoutSeconds 30) {
        Write-Ok "Tunel funcionando -- $publicUrl alcanca a API local"
    } else {
        Write-Warn "Nao foi possivel confirmar o tunel publicamente em 30s -- DNS pode ainda estar propagando. Verifique manualmente em instantes."
    }

    Write-Step "Validando /api/webhooks/asaas atraves do tunel..."
    # "-SkipHttpErrorCheck" so existe no PowerShell 7+ -- no Windows
    # PowerShell 5.1 (o padrao do Windows) esse parametro nao existe e
    # "Invoke-WebRequest" sempre lanca excecao em respostas 4xx/5xx. Uma
    # resposta 401 aqui e o resultado ESPERADO (sem assinatura valida), por
    # isso o status vem do objeto de excecao, nao de um parametro que evita a
    # excecao.
    $webhookUrl = "$publicUrl/api/webhooks/asaas"
    try {
        $webhookResponse = Invoke-WebRequest -Uri $webhookUrl -Method Post -Body "{}" -ContentType "application/json" -TimeoutSec 10 -UseBasicParsing
        Write-Ok "Endpoint de webhook respondeu (HTTP $($webhookResponse.StatusCode) -- prova que o tunel alcanca a rota)"
    } catch {
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            Write-Ok "Endpoint de webhook respondeu (HTTP $statusCode -- esperado sem assinatura valida, prova que o tunel alcanca a rota)"
        } else {
            Write-Warn "Nao foi possivel alcancar o endpoint de webhook publicamente: $($_.Exception.Message)"
        }
    }

    Write-Host " "
    Write-Host "========================================"
    Write-Host " "
    Write-Host "Smart Option API"
    Write-Host " "
    Write-Host "Running:"
    Write-Host " "
    Write-Host "http://localhost:$appPort"
    Write-Host " "
    Write-Host "Cloudflare Tunnel:"
    Write-Host " "
    Write-Host "$publicUrl"
    Write-Host " "
    Write-Host "Webhook URL:"
    Write-Host " "
    Write-Host "$publicUrl/api/webhooks/asaas"
    Write-Host " "
    Write-Host "========================================"
    Write-Host " "

    if ($TunnelProcess.HasExited) {
        Write-Fail "O processo do cloudflared encerrou sozinho logo apos subir -- confira se a config gerada em cloudflared\config.runtime.yml esta correta (ex.: `cloudflared tunnel --config cloudflared\config.runtime.yml run` rodado manualmente mostra o erro real)."
    } else {
        Write-Host 'Ambiente no ar. Pressione Ctrl+C para encerrar o tunel (o Docker continua rodando; use "npm run docker:down" para derruba-lo).'
        Wait-Process -Id $TunnelProcess.Id -ErrorAction SilentlyContinue
    }
} finally {
    if ($TunnelProcess -and -not $TunnelProcess.HasExited) {
        Write-Host "`nEncerrando ambiente de desenvolvimento..."
        Stop-Process -Id $TunnelProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
