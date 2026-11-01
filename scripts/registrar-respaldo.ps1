# Registra la tarea programada "TallerWeb Respaldo" que corre scripts\respaldo.ps1 todos los días a las 18:00.
$script = Join-Path $PSScriptRoot 'respaldo.ps1'
$accion = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
$disparador = New-ScheduledTaskTrigger -Daily -At '18:00'
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable
Register-ScheduledTask -TaskName 'TallerWeb Respaldo' -Action $accion -Trigger $disparador -Settings $ajustes -Force
Write-Output 'Tarea "TallerWeb Respaldo" registrada (diaria 18:00).'
