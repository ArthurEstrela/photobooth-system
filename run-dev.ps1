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

# Abre o frontend em modo kiosk (tela cheia, sem UI do browser)
Write-Host "Abrindo Chrome em modo kiosk..." -ForegroundColor Gray
Start-Sleep -Seconds 3
$chromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($chrome) {
    Start-Process $chrome -ArgumentList "--kiosk http://localhost:5173 --noerrdialogs --disable-infobars --disable-session-crashed-bubble"
} else {
    Write-Host "  Chrome nao encontrado. Abra manualmente: http://localhost:5173" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Sistema iniciado!" -ForegroundColor Green
Write-Host "  Backend:          http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Frontend (kiosk): http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Booth Controller: janela separada (aguardando PAYMENT_APPROVED)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para sair do modo kiosk: Alt+F4 ou Ctrl+W" -ForegroundColor Gray
