import { io, Socket } from 'socket.io-client';
import * as robot from 'robotjs';
import * as dotenv from 'dotenv';

dotenv.config();

const WS_URL = process.env.BACKEND_WS_URL || 'http://localhost:3001/booth';
const BOOTH_ID = process.env.BOOTH_ID || 'booth_123';
const AUTH_TOKEN = process.env.BOOTH_AUTH_TOKEN || '';
const TRIGGER_DELAY = parseInt(process.env.TRIGGER_DELAY || '2000');

class BoothController {
  private socket: Socket;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000; // 30 segundos máximo

  constructor() {
    console.log(`[BOOT] Iniciando controlador para Cabine: ${BOOTH_ID}`);
    this.connect();
  }

  private connect() {
    this.socket = io(WS_URL, {
      query: { 
        boothId: BOOTH_ID, 
        authToken: AUTH_TOKEN 
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: this.maxReconnectDelay,
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on('connect', () => {
      console.log(`[WS] Conectado ao servidor! Aguardando pagamentos...`);
      this.reconnectAttempts = 0;
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, this.maxReconnectDelay);
      console.error(`[WS] Erro de conexão: ${error.message}. Tentando novamente em ${delay/1000}s...`);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn(`[WS] Desconectado: ${reason}`);
    });

    // EVENTO CRÍTICO: Pagamento Aprovado
    this.socket.on('PAYMENT_APPROVED', (data: any) => {
      console.log('--------------------------------------------------');
      console.log(`[OK] PAGAMENTO APROVADO! ID: ${data.boothId}`);
      console.log(`[OS] Disparando Sparkbooth em ${TRIGGER_DELAY}ms...`);
      console.log('--------------------------------------------------');

      setTimeout(() => {
        try {
          // Garante que o foco estará no Sparkbooth (o usuário deve ter o app aberto)
          // RobotJS simula o pressionamento da tecla ENTER
          robot.keyTap('enter');
          console.log(`[SUCCESS] Tecla ENTER enviada com sucesso.`);
        } catch (err) {
          console.error(`[ERROR] Falha ao interagir com o teclado:`, err);
        }
      }, TRIGGER_DELAY);
    });

    // Logger para debug
    this.socket.on('WAITING_PAYMENT', () => {
      console.log(`[INFO] Cliente iniciou tentativa de pagamento na cabine.`);
    });
  }
}

// Inicializa o controlador
new BoothController();
