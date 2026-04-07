# Photobooth System - Setup Script (PowerShell)
# Execute a partir da raiz do projeto: .\setup.ps1

$root = $PSScriptRoot

Write-Host "--- Iniciando Setup do Photobooth System ---" -ForegroundColor Cyan

# 1. Copiar .env dos módulos se não existirem
Write-Host "[1/6] Verificando arquivos .env..." -ForegroundColor Yellow

if (-Not (Test-Path "$root\.env")) {
    Copy-Item "$root\.env.example" "$root\.env"
    Write-Host "  Criado: .env (raiz)"
}
if (-Not (Test-Path "$root\backend\.env")) {
    Copy-Item "$root\backend\.env.example" "$root\backend\.env" -ErrorAction SilentlyContinue
    if (Test-Path "$root\backend\.env") {
        Write-Host "  Criado: backend\.env"
    } else {
        Write-Host "  AVISO: backend\.env.example nao encontrado. Crie o backend\.env manualmente." -ForegroundColor Red
    }
}
if (-Not (Test-Path "$root\frontend\.env")) {
    Copy-Item "$root\frontend\.env.example" "$root\frontend\.env" -ErrorAction SilentlyContinue
    Write-Host "  Criado: frontend\.env"
}
if (-Not (Test-Path "$root\booth-controller\.env")) {
    Copy-Item "$root\booth-controller\.env.example" "$root\booth-controller\.env"
    Write-Host "  Criado: booth-controller\.env"
}

# 2. Instalar dependências do Backend
Write-Host "[2/6] Instalando dependencias do Backend..." -ForegroundColor Yellow
Set-Location "$root\backend"
npm install --silent
npx prisma generate

# 3. Instalar dependências do Frontend
Write-Host "[3/6] Instalando dependencias do Frontend..." -ForegroundColor Yellow
Set-Location "$root\frontend"
npm install --silent

# 4. Instalar dependências do Booth Controller
Write-Host "[4/6] Instalando dependencias do Booth Controller..." -ForegroundColor Yellow
Write-Host "  (Nota: robotjs exige C++ Build Tools. Se falhar, instale o Visual Studio Build Tools 2022)" -ForegroundColor Gray
Set-Location "$root\booth-controller"
npm install --silent

Set-Location $root

# 5. Subir infraestrutura Docker e aguardar o banco estar pronto
Write-Host "[5/6] Subindo containers Docker (Postgres e Redis)..." -ForegroundColor Yellow
docker-compose up -d

Write-Host "  Aguardando PostgreSQL ficar pronto..." -ForegroundColor Gray
$maxAttempts = 20
$attempt = 0
do {
    $attempt++
    Start-Sleep -Seconds 2
    $result = docker-compose exec -T postgres pg_isready -U postgres 2>&1
    if ($LASTEXITCODE -eq 0) { break }
    Write-Host "  Tentativa $attempt/$maxAttempts..." -ForegroundColor Gray
} while ($attempt -lt $maxAttempts)

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: PostgreSQL nao ficou pronto a tempo. Verifique o Docker." -ForegroundColor Red
    exit 1
}
Write-Host "  PostgreSQL pronto." -ForegroundColor Green

# 6. Executar migração do Prisma (cria as tabelas no banco)
Write-Host "[6/6] Executando migracao do Prisma (criando tabelas)..." -ForegroundColor Yellow
Set-Location "$root\backend"
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "  migrate deploy falhou — tentando db push (modo dev)..." -ForegroundColor Gray
    npx prisma db push
}

Set-Location $root

Write-Host ""
Write-Host "--- Setup Concluido com Sucesso! ---" -ForegroundColor Green
Write-Host "IMPORTANTE: Edite backend\.env e preencha:" -ForegroundColor Yellow
Write-Host "  - MERCADO_PAGO_ACCESS_TOKEN" -ForegroundColor Yellow
Write-Host "  - WEBHOOK_BASE_URL (use ngrok: ngrok http 3000)" -ForegroundColor Yellow
Write-Host "  - BOOTH_AUTH_TOKEN" -ForegroundColor Yellow
Write-Host ""
Write-Host "Para iniciar o sistema: .\run-dev.ps1" -ForegroundColor Cyan
