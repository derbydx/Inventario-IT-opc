$ErrorActionPreference = "Continue"
$Backend = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "backend"
Set-Location $Backend
Write-Host "Starting server on port 3131..." -ForegroundColor Cyan
python -m uvicorn main:app --host 0.0.0.0 --port 3131 --reload --app-dir $Backend
