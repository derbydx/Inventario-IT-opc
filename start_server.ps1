$ErrorActionPreference = "Continue"
$Backend = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "backend"
Set-Location $Backend
Write-Host "Starting server on port 8000..." -ForegroundColor Cyan
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload --app-dir $Backend
