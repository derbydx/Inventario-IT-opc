param(
    [switch]$Test,
    [switch]$Stop,
    [switch]$Rebuild,
    [switch]$Prod
)

if ($Stop) {
    docker compose down
    if ($?) { Write-Host "Contenedor detenido" -ForegroundColor Green }
    exit
}

$composeArgs = @()

if ($Test) {
    $composeArgs += "-f", "docker-compose.test.yml"
    $label = "PRUEBA"
    $port = 3132
} else {
    $label = "PRODUCCION"
    $port = 3131
}

if ($Rebuild) {
    $composeArgs += "--build"
}

$composeArgs += "up", "-d"

& "docker" "compose" $composeArgs

if ($?) {
    Write-Host "[$label] Corriendo en http://localhost:$port" -ForegroundColor Green
} else {
    Write-Host "Error al iniciar el contenedor" -ForegroundColor Red
}
