$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User")
Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Host "API - Bot Orchestrator" -ForegroundColor Cyan
npm run dev:api
