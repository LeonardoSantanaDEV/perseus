$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User")
Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Host "Perseus — API" -ForegroundColor Cyan
npm run dev:api
