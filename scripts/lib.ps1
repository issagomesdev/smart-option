# Funcoes compartilhadas por start-dev.ps1 e start-tunnel.ps1.
# Apenas ASCII neste arquivo de proposito: Windows PowerShell 5.1 le .ps1
# sem BOM usando o codepage do sistema, nao UTF-8 -- caracteres acentuados
# corrompem silenciosamente o parser (aspas fantasma, tokens quebrados).

$Script:RootDir = Split-Path -Parent $PSScriptRoot
$Script:EnvFile = Join-Path $Script:RootDir ".env"

function Write-Step($Message) { Write-Host "`n> $Message" }
function Write-Ok($Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Fail($Message) { Write-Host "[ERRO] $Message" -ForegroundColor Red }
function Write-Warn($Message) { Write-Host "[AVISO] $Message" -ForegroundColor Yellow }

function Get-EnvValue {
    param([string]$Key, [string]$Default = "")
    if (-not (Test-Path $Script:EnvFile)) { return $Default }
    $line = Get-Content $Script:EnvFile | Where-Object { $_ -match "^$Key=" } | Select-Object -Last 1
    if (-not $line) { return $Default }
    $value = $line -replace "^$Key=", ""
    if ([string]::IsNullOrEmpty($value)) { return $Default }
    return $value
}

function Set-EnvValue {
    param([string]$Key, [string]$Value)
    if (-not (Test-Path $Script:EnvFile)) {
        Write-Fail ".env nao encontrado em $Script:EnvFile"
        return
    }
    $content = Get-Content $Script:EnvFile
    if ($content -match "^$Key=") {
        $content = $content -replace "^$Key=.*", "$Key=$Value"
        Set-Content -Path $Script:EnvFile -Value $content -Encoding utf8
    } else {
        Add-Content -Path $Script:EnvFile -Value "$Key=$Value" -Encoding utf8
    }
}

function Assert-EnvFile {
    if (-not (Test-Path $Script:EnvFile)) {
        Write-Fail ".env nao encontrado. Copie .env.development.example para .env e preencha os valores."
        exit 1
    }
}

function Test-DockerAvailable {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Fail "Docker nao encontrado no PATH. Instale/inicie o Docker Desktop: https://www.docker.com/products/docker-desktop/"
        return $false
    }
    docker version | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Docker instalado mas nao respondendo -- o Docker Desktop esta aberto e rodando?"
        return $false
    }
    return $true
}

function Test-CloudflaredInstalled {
    return [bool](Get-Command cloudflared -ErrorAction SilentlyContinue)
}

function Show-CloudflaredInstallInstructions {
    Write-Host " "
    Write-Host "O cloudflared nao foi encontrado no PATH. Instale com uma das opcoes abaixo e rode o comando de novo."
    Write-Host " "
    Write-Host "  Windows (Chocolatey):    choco install cloudflared"
    Write-Host "  Windows (Scoop):         scoop install cloudflared"
    Write-Host "  macOS (Homebrew):        brew install cloudflared"
    Write-Host "  Linux (deb/rpm/binario): https://pkg.cloudflare.com/index.html"
    Write-Host "  Qualquer sistema:        https://github.com/cloudflare/cloudflared/releases"
    Write-Host " "
    Write-Host "Depois de instalar, autentique com a sua conta Cloudflare (abre o navegador,"
    Write-Host "escolha a zona byissa.dev quando solicitado):"
    Write-Host " "
    Write-Host "  cloudflared tunnel login"
    Write-Host " "
    Write-Host "Isso cria $env:USERPROFILE\.cloudflared\cert.pem -- so precisa ser feito uma vez por maquina."
}

function Test-CloudflaredLoggedIn {
    $certPath = Join-Path $env:USERPROFILE ".cloudflared\cert.pem"
    return Test-Path $certPath
}

# Roda "cloudflared" capturando stdout+stderr como texto e devolve a saida,
# preservando $LASTEXITCODE. O cloudflared escreve seu log normal (INF) em
# stderr -- em Windows PowerShell 5.1, redirecionar stderr de um executavel
# nativo (2>&1) com $ErrorActionPreference = "Stop" (ligado no topo dos
# scripts start-*.ps1) faz o PowerShell tratar cada linha de log como um
# NativeCommandError terminante e abortar o script, mesmo quando o comando
# teve exit code 0. Rebaixar $ErrorActionPreference so durante a chamada
# evita isso sem enfraquecer o resto do script.
function Invoke-CloudflaredCapture {
    param([string[]]$ArgumentList)
    $previous = $ErrorActionPreference
    # "SilentlyContinue", nao "Continue": com "Continue" o PowerShell ainda
    # imprime cada linha de stderr como um NativeCommandError em vermelho,
    # mesmo sem abortar o script -- ruido enganoso, ja que o texto real (a
    # mensagem INF do cloudflared) ja e devolvido e impresso pelo chamador.
    $ErrorActionPreference = "SilentlyContinue"
    try {
        return (& cloudflared @ArgumentList 2>&1 | Out-String)
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Confirm-Tunnel {
    $tunnelName = "smart-option-dev"
    $tunnelId = Get-EnvValue -Key "CF_TUNNEL_ID"
    $domain = Get-EnvValue -Key "CF_TUNNEL_DOMAIN" -Default "smartoptiondev.byissa.dev"
    $cfHost = Get-EnvValue -Key "CF_TUNNEL_HOST" -Default "localhost"
    $appPort = Get-EnvValue -Key "APP_PORT" -Default "3000"

    $credentialsDir = Join-Path $Script:RootDir "cloudflared\credentials"
    New-Item -ItemType Directory -Force -Path $credentialsDir | Out-Null

    if ([string]::IsNullOrEmpty($tunnelId)) {
        Write-Step "Nenhum CF_TUNNEL_ID configurado -- criando um tunel nomeado ($tunnelName)..."
        $createOutput = Invoke-CloudflaredCapture -ArgumentList @("tunnel", "create", $tunnelName)
        Write-Host $createOutput

        if ($createOutput -match '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}') {
            $tunnelId = $Matches[0]
        } else {
            Write-Fail "Nao consegui identificar o ID do tunel criado -- crie manualmente e defina CF_TUNNEL_ID no .env."
            return $null
        }

        $defaultCreds = Join-Path $env:USERPROFILE ".cloudflared\$tunnelId.json"
        if (Test-Path $defaultCreds) {
            Copy-Item $defaultCreds (Join-Path $credentialsDir "$tunnelId.json") -Force
        }

        Set-EnvValue -Key "CF_TUNNEL_ID" -Value $tunnelId
        Write-Ok "Tunel criado: $tunnelId"
    } else {
        Write-Ok "Reaproveitando tunel existente: $tunnelId"
        $localCreds = Join-Path $credentialsDir "$tunnelId.json"
        if (-not (Test-Path $localCreds)) {
            $defaultCreds = Join-Path $env:USERPROFILE ".cloudflared\$tunnelId.json"
            if (Test-Path $defaultCreds) { Copy-Item $defaultCreds $localCreds -Force }
        }
    }

    # Roda sempre, mesmo reaproveitando um tunel existente -- "route dns" e
    # idempotente (nao falha se o CNAME ja existir apontando pro mesmo
    # tunel). Sem isso, um CF_TUNNEL_ID ja salvo mas cujo dominio mudou (ou
    # cujo DNS nunca foi criado de fato) fica com o tunel conectado a
    # Cloudflare mas inalcancavel por fora -- "Could not resolve host" no
    # dominio publico, bug real encontrado ao verificar esta fase.
    Write-Step "Garantindo registro DNS para $domain..."
    $routeOutput = Invoke-CloudflaredCapture -ArgumentList @("tunnel", "route", "dns", $tunnelName, $domain)
    Write-Host $routeOutput
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "DNS configurado: $domain -> tunel $tunnelName"
    } else {
        Write-Warn "Nao foi possivel confirmar/criar o registro DNS automaticamente (pode ja existir apontando para outro tunel, ou a zona byissa.dev nao esta nesta conta). Verifique manualmente no painel Cloudflare > DNS."
    }

    $template = Get-Content (Join-Path $Script:RootDir "cloudflared\config.yml") -Raw
    $rendered = $template `
        -replace '\{\{CF_TUNNEL_ID\}\}', $tunnelId `
        -replace '\{\{CF_TUNNEL_DOMAIN\}\}', $domain `
        -replace '\{\{CF_TUNNEL_HOST\}\}', $cfHost `
        -replace '\{\{APP_PORT\}\}', $appPort

    $runtimeConfig = Join-Path $Script:RootDir "cloudflared\config.runtime.yml"
    Set-Content -Path $runtimeConfig -Value $rendered -Encoding utf8

    return [PSCustomObject]@{
        ConfigPath = $runtimeConfig
        Domain     = $domain
    }
}

function Wait-ForHttp {
    param([string]$Url, [int]$TimeoutSeconds = 30)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 3 -UseBasicParsing
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { return $true }
        } catch {
            # ainda nao esta pronto -- tenta de novo ate o timeout.
        }
        Start-Sleep -Seconds 1
    }
    return $false
}
