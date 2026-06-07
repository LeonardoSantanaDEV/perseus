# Perseus - start.ps1
# Sobe toda a stack com um unico comando: .\start.ps1

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User")

$logFile = "$root\start.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

function Log($msg, $color = "White") {
    $line = "[$([datetime]::Now.ToString('HH:mm:ss'))] $msg"
    Write-Host $line -ForegroundColor $color
    Add-Content -Path $logFile -Value $line -Encoding UTF8
}

function Step($msg) {
    Log ""
    Log "==> $msg" "Cyan"
}

# Inicia log
"" | Set-Content $logFile -Encoding UTF8
Log "Perseus iniciando... ($timestamp)" "Cyan"
Log "Log salvo em: $logFile" "Gray"

try {

    # 1. Verificacao do Docker
    Step "Verificando Docker..."
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Log "ERRO: Docker nao esta rodando!" "Red"
        Log "Solucao: Abra o Docker Desktop e aguarde ele inicializar completamente." "Yellow"
        Log "Depois execute .\start.ps1 novamente." "Yellow"
        throw "Docker nao disponivel. Inicie o Docker Desktop primeiro."
    }
    Log "Docker OK." "Green"

    # 2. Docker Compose
    Step "Subindo infraestrutura Docker (Postgres + Redis + MinIO)..."
    $composeOut = docker compose up -d --force-recreate 2>&1
    $composeOut | ForEach-Object { Log "  [docker] $_" "Gray" }
    if ($LASTEXITCODE -ne 0) {
        Log "Dica: se houver conflito de porta, pare outros containers com: docker compose down" "Yellow"
        throw "Falha ao subir containers Docker. Veja o log acima."
    }
    Log "Containers Docker OK." "Green"

    # 3. Copia .env se nao existir
    Step "Verificando arquivos de configuracao..."
    if (-not (Test-Path "$root\apps\api\.env")) {
        Copy-Item "$root\apps\api\.env.example" "$root\apps\api\.env"
        Log "  .env criado em apps/api/.env" "Green"
    } else {
        Log "  apps/api/.env ja existe." "Gray"
    }
    if (-not (Test-Path "$root\apps\web\.env")) {
        Copy-Item "$root\apps\web\.env.example" "$root\apps\web\.env"
        Log "  .env criado em apps/web/.env" "Green"
    } else {
        Log "  apps/web/.env ja existe." "Gray"
    }

    # 4. Aguarda Postgres (max 60s)
    Step "Aguardando Postgres ficar disponivel..."
    $tries = 0
    $pgReady = $false
    do {
        Start-Sleep -Seconds 2
        $tries++
        $pgOut = docker exec perseus_postgres pg_isready -U perseus -d perseus 2>&1
        Log "  [pg check $tries] $pgOut" "Gray"
        if ($pgOut -match "accepting connections") { $pgReady = $true }
    } while (-not $pgReady -and $tries -lt 30)

    if (-not $pgReady) {
        Log "Containers em execucao:" "Yellow"
        docker ps --format "table {{.Names}}\t{{.Status}}" 2>&1 | ForEach-Object { Log "  $_" "Yellow" }
        throw "Postgres nao ficou disponivel em 60s. Verifique: docker ps"
    }
    Log "Postgres pronto!" "Green"

    # 5. npm install (sempre, por workspace — evita conflito com Prisma DLL em uso)
    Step "Instalando dependencias npm..."
    $npmWeb = npm install --workspace=apps/web 2>&1
    $npmWeb | ForEach-Object { Log "  [npm:web] $_" "Gray" }
    if ($LASTEXITCODE -ne 0) { throw "Falha no npm install (apps/web)." }
    # Instala raiz apenas se node_modules nao existe ainda
    if (-not (Test-Path "$root\node_modules\typescript")) {
        $npmRoot = npm install --ignore-scripts 2>&1
        $npmRoot | ForEach-Object { Log "  [npm:root] $_" "Gray" }
    } else {
        Log "Dependencias raiz ja instaladas." "Gray"
    }

    # 6. Migration + Seed
    Step "Aplicando migrations do banco..."
    Set-Location "$root\apps\api"
    $migrateOut = npx prisma migrate deploy 2>&1
    $migrateOut | ForEach-Object { Log "  [prisma] $_" "Gray" }
    if ($LASTEXITCODE -ne 0) {
        Set-Location $root
        throw "Falha na migration do banco. Verifique o DATABASE_URL no .env."
    }

    Step "Gerando Prisma Client..."
    $generateOut = npx prisma generate 2>&1
    $generateOut | ForEach-Object { Log "  [prisma] $_" "Gray" }
    if ($LASTEXITCODE -ne 0) {
        Set-Location $root
        throw "Falha ao gerar Prisma Client."
    }

    Step "Executando seed (usuario admin)..."
    $seedOut = npx ts-node prisma/seed.ts 2>&1
    $seedOut | ForEach-Object { Log "  [seed] $_" "Gray" }
    if ($LASTEXITCODE -ne 0) {
        Log "Aviso: seed retornou erro (pode ser normal se o admin ja existe)." "Yellow"
    }
    Set-Location $root

    # 7. API em nova janela
    Step "Iniciando API em nova janela..."
    Start-Process powershell -ArgumentList "-NoExit -File `"$root\scripts\start-api.ps1`""
    Log "Janela da API aberta." "Green"

    # 8. Frontend em nova janela
    Step "Iniciando Frontend em nova janela..."
    Start-Process powershell -ArgumentList "-NoExit -File `"$root\scripts\start-web.ps1`""
    Log "Janela do Frontend aberta." "Green"

    # 9. Aguarda API responder (max 60s)
    Step "Aguardando API ficar disponivel..."
    $apiReady = $false
    for ($i = 1; $i -le 60; $i++) {
        Start-Sleep -Seconds 1
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/me" `
                 -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($r.StatusCode -in @(200, 401)) { $apiReady = $true; break }
        } catch {
            if ($_.Exception.Response.StatusCode.value__ -eq 401) { $apiReady = $true; break }
        }
        if ($i % 5 -eq 0) { Log "  Aguardando API... ($i/60s)" "Gray" }
    }

    if ($apiReady) {
        Log "API disponivel!" "Green"
    } else {
        Log "AVISO: API nao respondeu em 60s. Verifique a janela da API para erros." "Yellow"
    }

    Start-Sleep -Seconds 2
    Start-Process "http://localhost:5173"

    Log "" 
    Log "============================================================" "Green"
    Log "  Perseus rodando!" "Green"
    Log "  Frontend : http://localhost:5173" "Green"
    Log "  API      : http://localhost:3000/api" "Green"
    Log "  MinIO    : http://localhost:9001  (minioadmin / minioadmin)" "Green"
    Log "  Login    : admin@local / admin123" "Green"
    Log "  Log      : $logFile" "Green"
    Log "  Parar    : docker compose down + Ctrl+C nas janelas" "Green"
    Log "============================================================" "Green"

} catch {
    Log "" 
    Log "============================================================" "Red"
    Log "  ERRO AO INICIAR O PERSEUS" "Red"
    Log "============================================================" "Red"
    Log "  $($_.Exception.Message)" "Red"
    Log "" 
    Log "  Stack trace:" "Yellow"
    $_.ScriptStackTrace -split "`n" | ForEach-Object { Log "    $_" "Yellow" }
    Log "" 
    Log "  Log completo salvo em: $logFile" "Yellow"
    Log "============================================================" "Red"
}

Write-Host ""
Write-Host "Pressione ENTER para fechar..." -ForegroundColor Gray
Read-Host | Out-Null
