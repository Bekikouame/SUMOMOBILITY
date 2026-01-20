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
import { Logger, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';

interface LocationUpdate {
  rideId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
}

@Injectable()
@WebSocketGateway({
  namespace: '/ws', // ✅ Même namespace que NotificationsGateway
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class RidesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RidesGateway.name);
  private connectedUsers = new Map<string, { socket: Socket; userId: string; role: string }>();

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;

      if (!token) {
        this.logger.warn('Connexion sans token, rejet');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub || payload.userId || payload.id;

      if (!userId) {
        this.logger.warn('Token invalide, pas de userId');
        client.disconnect();
        return;
      }

      client.data.userId = userId;
      this.logger.log(`Client connecté: ${client.id}, userId: ${userId}`);

    } catch (error) {
      this.logger.error(`Erreur handleConnection: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    for (const [key, value] of this.connectedUsers.entries()) {
      if (value.socket.id === client.id) {
        this.logger.log(`User ${value.userId} (${value.role}) déconnecté`);
        this.connectedUsers.delete(key);
        break;
      }
    }

    this.logger.log(`Client disconnected: ${client.id}${userId ? ` (userId: ${userId})` : ''}`);
  }

  @SubscribeMessage('authenticate')
  async handleAuthenticate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; role: string }
  ) {
    if (!data.userId) {
      this.logger.warn(`Tentative d'authentification sans userId`);
      return { success: false, error: 'userId requis' };
    }

    const tokenUserId = client.data.userId;
    if (tokenUserId && tokenUserId !== data.userId) {
      this.logger.warn(
        `userId du token (${tokenUserId}) != userId fourni (${data.userId})`
      );
      return { success: false, error: 'userId ne correspond pas au token' };
    }

    const userRoom = `user:${data.userId}`;
    client.join(userRoom);

    this.connectedUsers.set(client.id, {
      socket: client,
      userId: data.userId,
      role: data.role,
    });

    this.logger.log(`User ${data.userId} (${data.role}) authentifié et a rejoint ${userRoom}`);

    const rooms = Array.from(client.rooms);
    this.logger.log(`Rooms du client ${client.id}: ${rooms.join(', ')}`);

    return {
      success: true,
      userId: data.userId,
      room: userRoom,
      rooms: rooms,
    };
  }

  // CORRIGÉ - Émet UNE SEULE FOIS vers le client
  @SubscribeMessage('driver.arrived')
  async handleDriverArrived(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { rideId: string; driverId: string; timestamp: string }
  ) {
    this.logger.log(`Chauffeur arrivé pour ride ${data.rideId}`);

    try {
      const ride = await this.prisma.ride.findUnique({
        where: { id: data.rideId },
        include: {
          client: { include: { user: true } }
        }
      });

      if (!ride) {
        this.logger.error(`Course ${data.rideId} non trouvée`);
        return;
      }

      const clientUserId = ride.client.user.id;
      const clientRoom = `user:${clientUserId}`;

      this.logger.log(`Émission driver.arrived vers ${clientRoom}`);

      // ÉMETTRE UNIQUEMENT VERS LE CLIENT (pas de doublon)
      this.server.to(clientRoom).emit('driver.arrived', {
        rideId: data.rideId,
        driverId: data.driverId,
        timestamp: data.timestamp,
      });

      this.logger.log(`Notification d'arrivée envoyée au client`);
    } catch (error) {
      this.logger.error(`Erreur handleDriverArrived: ${error.message}`);
    }
  }

  @SubscribeMessage('join-ride')
  async joinRide(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { rideId: string; userId: string; role: string }
  ) {
    client.join(`ride-${data.rideId}`);

    this.connectedUsers.set(client.id, {
      socket: client,
      userId: data.userId,
      role: data.role,
    });

    this.logger.log(`User ${data.userId} joined ride ${data.rideId}`);

    client.to(`ride-${data.rideId}`).emit('user-joined', {
      userId: data.userId,
      role: data.role,
    });
  }

  @SubscribeMessage('location-update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LocationUpdate
  ) {
    client.to(`ride-${data.rideId}`).emit('location-updated', {
      rideId: data.rideId,
      latitude: data.latitude,
      longitude: data.longitude,
      heading: data.heading,
      speed: data.speed,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('ride-status-change')
  async handleRideStatusChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { rideId: string; status: string; message?: string }
  ) {
    this.server.to(`ride-${data.rideId}`).emit('ride-status-changed', {
      rideId: data.rideId,
      status: data.status,
      message: data.message,
      timestamp: new Date(),
    });
  }

  notifyRideUpdate(rideId: string, event: string, data: any) {
    this.server.to(`ride-${rideId}`).emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  // ÉCOUTER L'ÉVÉNEMENT ride.requested
  @OnEvent('ride.requested')
  handleRideRequested(payload: {
    rideId: string;
    clientId: string;
    clientName: string;
    clientPhone: string;
    pickupAddress: string;
    destinationAddress: string;
    pickupLatitude: number;
    pickupLongitude: number;
    destinationLatitude: number;
    destinationLongitude: number;
    totalFare: number;
    baseFare: number;
    distanceKm: number;
    durationMinutes: number;
    passengerCount: number;
    rideType: string;
    notes?: string;
    status: string;
    requestedAt: Date;
    driverUserIds: string[];
  }) {
    this.logger.log(
      `Événement ride.requested reçu pour ride ${payload.rideId}, notifiant ${payload.driverUserIds.length} chauffeurs`
    );

    const allRooms = Array.from(this.server.sockets.adapter.rooms.keys());
    this.logger.log(`Rooms actives: ${allRooms.join(', ')}`);

    for (const driverUserId of payload.driverUserIds) {
      const userRoom = `user:${driverUserId}`;

      const roomExists = this.server.sockets.adapter.rooms.has(userRoom);
      this.logger.log(
        `Émission ride.request vers room ${userRoom} (existe: ${roomExists})`
      );

      this.server.to(userRoom).emit('ride.request', {
        // IDs
        rideId: payload.rideId,
        id: payload.rideId,
        
        // Client
        clientName: payload.clientName,
        clientPhone: payload.clientPhone,
        
        // Adresses
        pickupAddress: payload.pickupAddress,
        destinationAddress: payload.destinationAddress,
        
        // Coordonnées
        pickupLatitude: payload.pickupLatitude,
        pickupLongitude: payload.pickupLongitude,
        destinationLatitude: payload.destinationLatitude,
        destinationLongitude: payload.destinationLongitude,
        
        // Prix
        totalFare: payload.totalFare,
        baseFare: payload.baseFare,
        amount: payload.totalFare,
        
        // Détails
        distanceKm: payload.distanceKm,
        durationMinutes: payload.durationMinutes,
        passengerCount: payload.passengerCount,
        rideType: payload.rideType,
        notes: payload.notes,
        status: payload.status,
        
        // Timestamps
        requestedAt: payload.requestedAt,
        timestamp: new Date(),
      });
    }
  }

  // ÉCOUTER L'ÉVÉNEMENT ride.accepted
  @OnEvent('ride.accepted')
  async handleRideAccepted(payload: any) {
    const { rideId, clientId, driverId, driverName } = payload;

    this.logger.log(
      `Événement ride.accepted reçu pour ride ${rideId}`
    );

    try {
      const ride = await this.prisma.ride.findUnique({
        where: { id: rideId },
        include: {
          client: { include: { user: true } }
        }
      });

      if (!ride) {
        this.logger.error(`Course ${rideId} non trouvée`);
        return;
      }

      const clientUserId = ride.client.user.id;
      const clientRoomName = `user:${clientUserId}`;
      const roomExists = this.server.sockets.adapter.rooms.has(clientRoomName);

      this.logger.log(
        `Émission ride.accepted vers room ${clientRoomName} (existe: ${roomExists})`
      );

      this.server.to(clientRoomName).emit('ride.accepted', {
        rideId,
        driverId,
        driverName,
      });
    } catch (error) {
      this.logger.error(`Erreur handleRideAccepted: ${error.message}`);
    }
  }

  // Dans RidesGateway, ajoutez cette méthode :

@SubscribeMessage('ping')
handlePing(@ConnectedSocket() client: Socket) {
  client.emit('pong');
  return { success: true };
}

// ÉCOUTER L'ÉVÉNEMENT ride.started
@OnEvent('ride.started')
async handleRideStarted(payload: {
  rideId: string;
  clientId: string;
  driverId: string;
  destination: string;
}) {
  this.logger.log(`Événement ride.started reçu pour ride ${payload.rideId}`);

  try {
    const ride = await this.prisma.ride.findUnique({
      where: { id: payload.rideId },
      include: {
        client: { include: { user: true } },
        driver: { include: { user: true } }
      }
    });

    if (!ride) {
      this.logger.error(`Course ${payload.rideId} non trouvée`);
      return;
    }

    const clientUserId = ride.client.user.id;
    const clientRoom = `user:${clientUserId}`;

    this.logger.log(`Émission ride.started vers ${clientRoom}`);

    // NOTIFIER LE CLIENT
    this.server.to(clientRoom).emit('ride.started', {
      rideId: payload.rideId,
      destination: payload.destination,
      driverName: `${ride.driver?.user.firstName} ${ride.driver?.user.lastName}`,
      timestamp: new Date(),
    });

    this.logger.log(`Notification de démarrage envoyée au client`);
  } catch (error) {
    this.logger.error(`Erreur handleRideStarted: ${error.message}`);
  }
}
  // CORRIGÉ - Émet UNE SEULE FOIS vers client ET chauffeur
  notifyRideCanceled(payload: {
    rideId: string;
    canceledBy: string;
    reason: string;
    clientId?: string;
    driverId?: string;
  }) {
    this.logger.log(
      `Notification d'annulation pour ride ${payload.rideId} par ${payload.canceledBy}`
    );

    const cancelData = {
      rideId: payload.rideId,
      canceledBy: payload.canceledBy,
      reason: payload.reason,
      timestamp: new Date(),
    };

    const roomsNotified: string[] = [];

    // Notifier le client si présent
    if (payload.clientId) {
      const clientRoom = `user:${payload.clientId}`;
      this.server.to(clientRoom).emit('ride.canceled', cancelData);
      roomsNotified.push(clientRoom);
      this.logger.log(`Notification envoyée au client: ${clientRoom}`);
    }

    // Notifier le chauffeur si présent
    if (payload.driverId) {
      const driverRoom = `user:${payload.driverId}`;
      this.server.to(driverRoom).emit('ride.canceled', cancelData);
      roomsNotified.push(driverRoom);
      this.logger.log(`Notification envoyée au chauffeur: ${driverRoom}`);
    }


    // NE PLUS ÉMETTRE VERS ride-room (évite les doublons)
    // this.server.to(`ride-${payload.rideId}`).emit('ride.canceled', cancelData);

    this.logger.log(`Annulation envoyée vers: ${roomsNotified.join(', ')}`);
  }
}