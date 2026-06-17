param([switch]$NoInstall)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend"
$DbFile = Join-Path $Backend "inventario.db"

Write-Host "=== IT Asset Manager - Setup ===" -ForegroundColor Cyan

# 1. Python check
try {
    $py = (Get-Command python).Source
    Write-Host "[OK] Python: $($py)" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Python no encontrado. Instale Python 3.10+." -ForegroundColor Red
    exit 1
}

# 2. Virtual env
$Venv = Join-Path $Root ".venv"
if (-not (Test-Path $Venv)) {
    Write-Host "[...] Creando entorno virtual..." -ForegroundColor Yellow
    & $py -m venv $Venv
    if (-not $?) { Write-Host "[FAIL] No se pudo crear .venv" -ForegroundColor Red; exit 1 }
} else {
    Write-Host "[OK] Entorno virtual existe" -ForegroundColor Green
}

# 3. Activate & install deps
$Pip = Join-Path $Venv "Scripts\pip.exe"
if (-not (Test-Path $Pip)) {
    Write-Host "[FAIL] pip no encontrado en .venv" -ForegroundColor Red
    exit 1
}

$Req = Join-Path $Root "requirements.txt"
if (-not (Test-Path $Req)) {
    Write-Host "[FAIL] requirements.txt no encontrado" -ForegroundColor Red
    exit 1
}

if (-not $NoInstall) {
    Write-Host "[...] Instalando dependencias..." -ForegroundColor Yellow
    & $Pip install -r $Req --quiet
    if (-not $?) { Write-Host "[FAIL] Error al instalar dependencias" -ForegroundColor Red; exit 1 }
    Write-Host "[OK] Dependencias instaladas" -ForegroundColor Green
} else {
    Write-Host "[SKIP] Instalacion omitida (-NoInstall)" -ForegroundColor Yellow
}

# 4. Database check
if (-not (Test-Path $DbFile)) {
    Write-Host "[...] Base de datos no existe. Se creara al iniciar el servidor." -ForegroundColor Yellow
} else {
    Write-Host "[OK] Base de datos encontrada: $($DbFile)" -ForegroundColor Green
}

# 5. Cloudflare Tunnel check
$CfPath = "$env:LOCALAPPDATA\cloudflared\cloudflared.exe"
if (Test-Path $CfPath) {
    Write-Host "[OK] Cloudflared: $($CfPath)" -ForegroundColor Green
} else {
    Write-Host "[WARN] Cloudflared no encontrado. Instale desde: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" -ForegroundColor Yellow
}

# 6. Start server
$Python = Join-Path $Venv "Scripts\python.exe"
$Main = Join-Path $Backend "main.py"
$Host = "0.0.0.0"
$Port = 8000

Write-Host ""
Write-Host "Iniciando servidor en http://$($Host):$($Port)" -ForegroundColor Cyan
Write-Host "Para exponer via Tunnel: .\tunnel.bat" -ForegroundColor Cyan
Write-Host "Presione Ctrl+C para detener." -ForegroundColor Gray
Write-Host ""

& $Python -m uvicorn main:app --host $Host --port $Port --reload --app-dir $Backend