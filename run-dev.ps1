# Photobooth System - Run Script (PowerShell)
# Execute a partir da raiz do projeto: .\run-dev.ps1

$root = $PSScriptRoot

Write-Host "--- Iniciando todos os modulos ---" -ForegroundColor Cyan

# Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; npm run start:dev" -WindowStyle Normal

# Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev" -WindowStyle Normal

# Booth Controller — aguarda o backend subir antes de conectar
Write-Host "Aguardando backend iniciar (10s)..." -ForegroundColor Gray
Start-Sleep -Seconds 10
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\booth-controller'; npm start" -WindowStyle Normal

Write-Host ""
Write-Host "Modulos disparados em janelas separadas:" -ForegroundColor Green
Write-Host "  Backend:          http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Frontend (kiosk): http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Booth Controller: janela separada (aguardando PAYMENT_APPROVED)" -ForegroundColor Cyan
