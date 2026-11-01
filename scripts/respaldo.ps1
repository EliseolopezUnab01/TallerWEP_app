# Respaldo diario de la base taller_web y de los archivos subidos.
# Guarda en backups/ y borra los respaldos con más de 14 días.
# Registrar la tarea diaria (una sola vez, en PowerShell como administrador):
#   powershell -ExecutionPolicy Bypass -File scripts\registrar-respaldo.ps1

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$destino = Join-Path $raiz 'backups'
New-Item -ItemType Directory -Force -Path $destino | Out-Null

$envVars = @{ DB_HOST = 'localhost'; DB_PORT = '3306'; DB_USER = 'root'; DB_PASSWORD = ''; DB_NAME = 'taller_web' }
$envFile = Join-Path $raiz '.env.local'
if (Test-Path $envFile) {
  foreach ($linea in Get-Content $envFile) {
    if ($linea -match '^\s*(DB_[A-Z]+)\s*=\s*(.*)\s*$') { $envVars[$Matches[1]] = $Matches[2].Trim('"', "'") }
  }
}

$bin = if ($env:MYSQL_BIN_DIR) { $env:MYSQL_BIN_DIR } else { 'C:\xampp\mysql\bin' }
$sello = Get-Date -Format 'yyyyMMdd_HHmm'
$sql = Join-Path $destino "taller_web_$sello.sql"

$parametros = @("-h$($envVars.DB_HOST)", "-P$($envVars.DB_PORT)", "-u$($envVars.DB_USER)",
  '--default-character-set=utf8mb4', '--single-transaction', '--routines', '--triggers',
  "--result-file=$sql", $envVars.DB_NAME)
if ($envVars.DB_PASSWORD) { $parametros = @("-p$($envVars.DB_PASSWORD)") + $parametros }
& (Join-Path $bin 'mysqldump.exe') @parametros
if ($LASTEXITCODE -ne 0) { throw "mysqldump terminó con código $LASTEXITCODE" }

$uploads = Join-Path $raiz 'public\uploads'
if (Test-Path $uploads) {
  Compress-Archive -Path (Join-Path $uploads '*') -DestinationPath (Join-Path $destino "uploads_$sello.zip") -Force
}

Get-ChildItem $destino -File | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | Remove-Item -Force
Write-Output "Respaldo listo: $sql"
