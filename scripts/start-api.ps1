$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User")
Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Host "Perseus - API" -ForegroundColor Cyan
Write-Host "Log: apps/api/logs/api.log" -ForegroundColor Gray

try {
    npm run dev:api
} catch {
    Write-Host ""
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    Write-Host ""
    Write-Host "Pressione ENTER para fechar..." -ForegroundColor Gray
    Read-Host | Out-Null
}
