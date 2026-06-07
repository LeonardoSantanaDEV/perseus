# Bot Orchestrator - start.ps1
# Sobe toda a stack com um unico comando: .\start.ps1

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User")

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

# 1. Docker
Step "Subindo infraestrutura Docker..."
docker compose up -d
if ($LASTEXITCODE -ne 0) { throw "Falha ao subir containers Docker." }

# 2. Copia .env se nao existir
Step "Verificando arquivos de configuracao..."
if (-not (Test-Path "$root\apps\api\.env")) {
    Copy-Item "$root\apps\api\.env.example" "$root\apps\api\.env"
    Write-Host "  .env criado em apps/api/.env" -ForegroundColor Green
} else {
    Write-Host "  apps/api/.env ja existe." -ForegroundColor Gray
}
if (-not (Test-Path "$root\apps\web\.env")) {
    Copy-Item "$root\apps\web\.env.example" "$root\apps\web\.env"
    Write-Host "  .env criado em apps/web/.env" -ForegroundColor Green
} else {
    Write-Host "  apps/web/.env ja existe." -ForegroundColor Gray
}

# 3. Aguarda Postgres (max 30s)
Step "Aguardando Postgres ficar disponivel..."
$tries = 0
do {
    Start-Sleep -Seconds 2
    $tries++
    $ok = docker exec orch_postgres pg_isready -U orch -d orchestrator 2>$null
} while ($ok -notmatch "accepting connections" -and $tries -lt 15)
if ($tries -ge 15) { throw "Postgres nao ficou disponivel. Verifique: docker ps" }
Write-Host "  Postgres pronto!" -ForegroundColor Green

# 4. npm install se necessario
if (-not (Test-Path "$root\node_modules")) {
    Step "Instalando dependencias npm..."
    npm install
}

# 5. Migration + Seed
Step "Aplicando migrations..."
Set-Location "$root\apps\api"
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw "Falha na migration." }

Step "Executando seed (usuario admin)..."
npx ts-node prisma/seed.ts
Set-Location $root

# 6. API em nova janela (path entre aspas por causa do espaco em "Power Platform")
Step "Iniciando API em nova janela..."
Start-Process powershell -ArgumentList "-NoExit -File `"$root\scripts\start-api.ps1`""

# 7. Frontend em nova janela
Step "Iniciando Frontend em nova janela..."
Start-Process powershell -ArgumentList "-NoExit -File `"$root\scripts\start-web.ps1`""

# 8. Aguarda API responder (max 30s) e abre navegador
Step "Aguardando API ficar disponivel..."
$apiReady = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/me" `
             -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($r.StatusCode -in @(200, 401)) { $apiReady = $true; break }
    } catch {
        # 401 = API no ar (sem token). Considera disponivel.
        if ($_.Exception.Response.StatusCode.value__ -eq 401) { $apiReady = $true; break }
    }
}

if ($apiReady) {
    Write-Host "  API disponivel!" -ForegroundColor Green
} else {
    Write-Host "  API ainda nao respondeu. Aguarde a janela da API iniciar." -ForegroundColor Yellow
}

Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Bot Orchestrator rodando!" -ForegroundColor Green
Write-Host "  Frontend : http://localhost:5173" -ForegroundColor Green
Write-Host "  API      : http://localhost:3000/api" -ForegroundColor Green
Write-Host "  MinIO    : http://localhost:9001  (minioadmin / minioadmin)" -ForegroundColor Green
Write-Host "  Login    : admin@local / admin123" -ForegroundColor Green
Write-Host "  Parar    : docker compose down + Ctrl+C nas janelas" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
