import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BoothNotifierPort } from '../../../core/ports/out/ports';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({ cors: true, namespace: 'booth' })
export class BoothWebsocketGateway implements OnGatewayConnection, BoothNotifierPort {
  @WebSocketServer()
  server: Server;

  constructor(private configService: ConfigService) {}

  async handleConnection(client: Socket) {
    const boothId = client.handshake.query.boothId as string;
    const authToken = client.handshake.query.authToken as string;

    if (authToken !== this.configService.get('BOOTH_AUTH_TOKEN')) {
      console.log(`Connection rejected for booth ${boothId}: Invalid token`);
      client.disconnect();
      return;
    }

    if (boothId) {
      client.join(`booth_${boothId}`);
      console.log(`Booth ${boothId} connected to room`);
    }
  }

  async notifyPaymentApproved(boothId: string): Promise<void> {
    this.server.to(`booth_${boothId}`).emit('PAYMENT_APPROVED', { boothId, timestamp: new Date() });
  }

  async notifyPaymentExpired(boothId: string): Promise<void> {
    this.server.to(`booth_${boothId}`).emit('PAYMENT_EXPIRED', { boothId });
  }

  async notifyWaitingPayment(boothId: string, paymentData: any): Promise<void> {
    this.server.to(`booth_${boothId}`).emit('WAITING_PAYMENT', paymentData);
  }
}
