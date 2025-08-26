
// WEBSOCKETS - Tracking temps réel (optionnel)
// ===================================

// src/modules/rides/gateways/rides.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';

interface LocationUpdate {
  rideId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
}

@WebSocketGateway({
  cors: {
    origin: "*",
    credentials: true
  }
})
export class RidesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RidesGateway.name);
  private connectedUsers = new Map<string, { socket: Socket; userId: string; role: string }>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // Retirer le client de la map
    for (const [key, value] of this.connectedUsers.entries()) {
      if (value.socket.id === client.id) {
        this.connectedUsers.delete(key);
        break;
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-ride')
  async joinRide(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { rideId: string; userId: string; role: string }
  ) {
    // Rejoindre la room de la course
    client.join(`ride-${data.rideId}`);
    
    // Sauvegarder la connexion
    this.connectedUsers.set(client.id, {
      socket: client,
      userId: data.userId,
      role: data.role
    });

    this.logger.log(`User ${data.userId} joined ride ${data.rideId}`);
    
    // Notifier les autres participants
    client.to(`ride-${data.rideId}`).emit('user-joined', {
      userId: data.userId,
      role: data.role
    });
  }

  @SubscribeMessage('location-update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LocationUpdate
  ) {
    // Diffuser la position aux autres participants de la course
    client.to(`ride-${data.rideId}`).emit('location-updated', {
      rideId: data.rideId,
      latitude: data.latitude,
      longitude: data.longitude,
      heading: data.heading,
      speed: data.speed,
      timestamp: new Date()
    });
  }

  @SubscribeMessage('ride-status-change')
  async handleRideStatusChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { rideId: string; status: string; message?: string }
  ) {
    // Notifier tous les participants du changement de statut
    this.server.to(`ride-${data.rideId}`).emit('ride-status-changed', {
      rideId: data.rideId,
      status: data.status,
      message: data.message,
      timestamp: new Date()
    });
  }

  // Méthode utilitaire pour envoyer des notifications depuis le service
  notifyRideUpdate(rideId: string, event: string, data: any) {
    this.server.to(`ride-${rideId}`).emit(event, {
      ...data,
      timestamp: new Date()
    });
  }
}
