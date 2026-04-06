# Photobooth System - Setup Script (PowerShell)

Write-Host "--- Iniciando Setup do Photobooth System ---" -ForegroundColor Cyan

# 1. Copiar .env se não existir
if (-Not (Test-Path ".env")) {
    Write-Host "[1/5] Criando arquivo .env a partir do .env.example..."
    Copy-Item ".env.example" ".env"
}

# 2. Instalar dependências do Backend
Write-Host "[2/5] Instalando dependências do Backend..." -ForegroundColor Yellow
cd backend
npm install --silent
npx prisma generate
cd ..

# 3. Instalar dependências do Frontend
Write-Host "[3/5] Instalando dependências do Frontend..." -ForegroundColor Yellow
cd frontend
npm install --silent
cd ..

# 4. Instalar dependências do Booth Controller
Write-Host "[4/5] Instalando dependências do Booth Controller..." -ForegroundColor Yellow
Write-Host "(Nota: robotjs pode exigir C++ Build Tools instalados)" -ForegroundColor Gray
cd booth-controller
npm install --silent
if (-Not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}
cd ..

# 5. Infraestrutura Docker
Write-Host "[5/5] Subindo containers Docker (Postgres e Redis)..." -ForegroundColor Yellow
docker-compose up -d

Write-Host "`n--- Setup Concluído com Sucesso! ---" -ForegroundColor Green
Write-Host "Para iniciar o sistema, execute: .\run-dev.ps1" -ForegroundColor Cyan
