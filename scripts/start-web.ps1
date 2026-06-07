$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User")
Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Host "Perseus — Web" -ForegroundColor Magenta
npm run dev:web
