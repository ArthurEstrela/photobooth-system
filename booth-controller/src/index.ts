import { io, Socket } from 'socket.io-client';
import * as robot from 'robotjs';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

const WS_URL = process.env.BACKEND_WS_URL || 'http://localhost:3000/booth';
const BOOTH_ID = process.env.BOOTH_ID || 'booth_123';
const AUTH_TOKEN = process.env.BOOTH_AUTH_TOKEN || '';
const TRIGGER_DELAY = parseInt(process.env.TRIGGER_DELAY || '2000');
const TRIGGER_KEY = process.env.TRIGGER_KEY || 'space';
// Tempo da sessão do Sparkbooth em ms. Após esse tempo o Chrome volta para frente.
const SPARKBOOTH_SESSION_MS = parseInt(process.env.SPARKBOOTH_SESSION_MS || '50000');

function focusSparkbooth(): void {
  try {
    execSync(
      'powershell -Command "' +
      '$p = Get-Process | Where-Object { $_.MainWindowTitle -like \'*SparkBooth*\' -or $_.ProcessName -like \'*sparkbooth*\' } | Select-Object -First 1;' +
      'if ($p) { $wsh = New-Object -ComObject WScript.Shell; $wsh.AppActivate($p.Id) }"',
      { stdio: 'ignore' }
    );
  } catch {
    console.warn('[WARN] Não foi possível focar o Sparkbooth automaticamente.');
  }
}

class BoothController {
  private socket!: Socket;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;

  constructor() {
    console.log(`[BOOT] Iniciando controlador para Cabine: ${BOOTH_ID}`);
    this.connect();
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    setInterval(() => {
      if (this.socket?.connected) {
        console.log(`[HEARTBEAT] Conectado e operante - ${new Date().toISOString()}`);
      } else {
        console.warn(`[HEARTBEAT] Aguardando reconexão... - ${new Date().toISOString()}`);
      }
    }, 5 * 60 * 1000);
  }

  private connect(): void {
    this.socket = io(WS_URL, {
      query: { boothId: BOOTH_ID, authToken: AUTH_TOKEN },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: this.maxReconnectDelay,
    });

    this.setupListeners();
  }

  private setupListeners(): void {
    this.socket.on('connect', () => {
      console.log('[WS] Conectado ao servidor! Aguardando pagamentos...');
      this.reconnectAttempts = 0;
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, this.maxReconnectDelay);
      console.error(`[WS] Erro de conexão: ${error.message}. Tentando novamente em ${delay / 1000}s...`);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn(`[WS] Desconectado: ${reason}`);
    });

    this.socket.on('PAYMENT_APPROVED', (data: any) => {
      console.log('\n==================================================');
      console.log(`[OK] PAGAMENTO APROVADO! Cabine: ${data.boothId}`);
      console.log(`[OS] Focando Sparkbooth e disparando "${TRIGGER_KEY.toUpperCase()}" em ${TRIGGER_DELAY}ms...`);
      console.log('==================================================\n');

      setTimeout(() => {
        try {
          focusSparkbooth();
          // Pausa de 500ms para o foco ser transferido antes da tecla
          setTimeout(() => {
            robot.keyTap(TRIGGER_KEY);
            console.log(`[SUCCESS] Tecla ${TRIGGER_KEY.toUpperCase()} enviada ao Sparkbooth.`);

            // Após a sessão do Sparkbooth, traz o Chrome de volta
            setTimeout(() => {
              try {
                execSync(
                  'powershell -Command "' +
                  '$p = Get-Process | Where-Object { $_.ProcessName -like \'*chrome*\' -or $_.ProcessName -like \'*msedge*\' } | Select-Object -First 1;' +
                  'if ($p) { $wsh = New-Object -ComObject WScript.Shell; $wsh.AppActivate($p.Id) }"',
                  { stdio: 'ignore' }
                );
                console.log('[INFO] Chrome/Edge trazido para frente. Aguardando próximo cliente.');
              } catch {
                console.warn('[WARN] Não foi possível trazer o browser de volta.');
              }
            }, SPARKBOOTH_SESSION_MS);
          }, 500);
        } catch (err) {
          console.error('[ERROR] Falha ao interagir com o teclado:', err);
        }
      }, TRIGGER_DELAY);
    });

    this.socket.on('WAITING_PAYMENT', () => {
      console.log('[INFO] Novo cliente - Aguardando pagamento...');
    });
  }
}

new BoothController();
