# Photobooth System - Run Script (PowerShell)

Write-Host "--- Iniciando todos os módulos em paralelo ---" -ForegroundColor Cyan

# Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run start:dev" -WindowStyle Normal

# Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal

# Booth Controller
Write-Host "Aguardando backend iniciar para conectar o Booth Controller..." -ForegroundColor Gray
Start-Sleep -Seconds 5
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd booth-controller; npm start" -WindowStyle Normal

Write-Host "Todos os módulos foram disparados em janelas separadas." -ForegroundColor Green
