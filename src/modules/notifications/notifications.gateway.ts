// src/modules/notifications/notifications.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';

interface LocationUpdate {
  rideId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
}

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: '*',
  },
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  
  //  AJOUT : Flag d'initialisation
  private isInitialized = false;
  
  //  AJOUT : Queue pour les événements en attente
  private eventQueue: Array<{ type: string; payload: any }> = [];

  private socketUserMap = new Map<string, string>();
  private connectedUsers = new Map<string, { socket: Socket; userId: string; role: string }>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  //  NOUVEAU : Hook d'initialisation du module
  onModuleInit() {
    this.logger.log(' NotificationsGateway - Module initialisé');
  }

  //  AMÉLIORATION : Hook d'initialisation WebSocket
  afterInit(server: Server) {
    this.server = server; // Assigner explicitement le serveur
    this.isInitialized = true;
    this.logger.log(' WebSocket Gateway complètement initialisé');
    this.logger.log(` Server disponible: ${!!this.server}`);
    this.logger.log(` Sockets disponibles: ${!!this.server?.sockets}`);
    this.logger.log(` Adapter disponible: ${!!this.server?.sockets?.adapter}`);

    //  Traiter la queue d'événements en attente
    if (this.eventQueue.length > 0) {
      this.logger.log(` Traitement de ${this.eventQueue.length} événements en attente`);
      this.eventQueue.forEach(({ type, payload }) => {
        this.processEvent(type, payload);
      });
      this.eventQueue = [];
    }
  }

  //  NOUVELLE MÉTHODE : Traiter un événement
  private processEvent(type: string, payload: any) {
    switch (type) {
      case 'ride.requested':
        this.emitRideRequest(payload);
        break;
      case 'ride.accepted':
        this.emitRideAccepted(payload);
        break;
      case 'ride.started':
        this.emitRideStarted(payload);
        break;
      // Ajoutez d'autres cas si nécessaire
      default:
        this.logger.warn(`Type d'événement inconnu: ${type}`);
    }
  }

  async handleConnection(client: Socket) {
    try {
      const auth: any = client.handshake.auth || {};
      const query: any = client.handshake.query || {};
      const headerAuth = client.handshake.headers.authorization as string | undefined;

      let token: string | undefined =
        auth.token ||
        query.token ||
        (headerAuth?.startsWith('Bearer ')
          ? headerAuth.substring('Bearer '.length)
          : undefined);

      if (!token) {
        this.logger.warn('Socket WITHOUT token → disconnect');
        client.disconnect();
        return;
      }

      const payload: any = this.jwtService.verify(token);
      const userId: string | undefined = payload.sub;

      if (!userId) {
        this.logger.warn('Socket token without sub → disconnect');
        client.disconnect();
        return;
      }

      this.socketUserMap.set(client.id, userId);
      client.join(`user:${userId}`);

      this.logger.log(
        ` Socket connecté: socketId=${client.id}, userId=${userId}`,
      );

      // Envoyer les courses en attente si c'est un chauffeur ONLINE
      await this.sendPendingRidesToDriver(client, userId);
    } catch (err) {
      this.logger.log('Socket auth error', err);
      client.disconnect();
    }
  }

  private async sendPendingRidesToDriver(client: Socket, userId: string) {
    try {
      const driverProfile = await this.prisma.driverProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          status: true,
          activityStatus: true,
          vehicles: { where: { verified: true, status: 'AVAILABLE' } },
        },
      });

      if (
        !driverProfile ||
        driverProfile.status !== 'APPROVED' ||
        driverProfile.activityStatus !== 'ONLINE'
      ) {
        return;
      }

      // Récupérer les courses REQUESTED des 10 dernières minutes
      const since = new Date(Date.now() - 10 * 60 * 1000);
      const pendingRides = await this.prisma.ride.findMany({
        where: {
          status: 'REQUESTED',
          driverId: null,
          createdAt: { gte: since },
        },
        include: {
          client: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      if (pendingRides.length === 0) return;

      this.logger.log(
        `[REPLAY] Envoi de ${pendingRides.length} course(s) en attente au chauffeur ${userId}`
      );

      for (const ride of pendingRides) {
        client.emit('ride.request', {
          rideId: ride.id,
          id: ride.id,
          clientName: `${ride.client.user.firstName} ${ride.client.user.lastName}`,
          clientPhone: ride.client.user.phone,
          pickupAddress: ride.pickupAddress,
          destinationAddress: ride.destinationAddress,
          pickupLatitude: ride.pickupLatitude,
          pickupLongitude: ride.pickupLongitude,
          destinationLatitude: ride.destinationLatitude,
          destinationLongitude: ride.destinationLongitude,
          totalFare: ride.totalFare,
          baseFare: ride.baseFare,
          amount: ride.totalFare,
          distanceKm: ride.distanceKm,
          durationMinutes: ride.durationMinutes ?? 0,
          passengerCount: ride.passengerCount,
          rideType: ride.rideType,
          notes: ride.notes,
          status: ride.status,
          requestedAt: ride.requestedAt,
          timestamp: new Date(),
        });
      }
    } catch (err) {
      this.logger.warn(`[REPLAY] Erreur sendPendingRidesToDriver: ${err.message}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketUserMap.get(client.id);
    this.logger.log(
      `Socket disconnected: socketId=${client.id}, userId=${userId}`,
    );
    this.socketUserMap.delete(client.id);

    for (const [key, value] of this.connectedUsers.entries()) {
      if (value.socket.id === client.id) {
        this.logger.log(`User ${value.userId} (${value.role}) déconnecté`);
        this.connectedUsers.delete(key);
        break;
      }
    }
  }

  /**
   *  AMÉLIORATION : Gestion avec queue si non initialisé
   */
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
      ` Événement ride.requested reçu pour ride ${payload.rideId}, notifiant ${payload.driverUserIds.length} chauffeurs`
    );

    //  Si pas encore initialisé, mettre en queue
    if (!this.isInitialized || !this.server || !this.server.sockets) {
      this.logger.warn(' Serveur WebSocket non prêt, événement mis en queue');
      this.eventQueue.push({ type: 'ride.requested', payload });
      return;
    }

    this.emitRideRequest(payload);
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Extraire la logique d'émission
   */
  private emitRideRequest(payload: any) {
    try {
      // ✅ Vérification plus permissive - juste vérifier que server existe
      if (!this.server) {
        this.logger.log(' Serveur WebSocket non disponible');
        return;
      }

      // ✅ Log des rooms uniquement si l'adapter est disponible
      if (this.server.sockets?.adapter) {
        const allRooms = Array.from(this.server.sockets.adapter.rooms.keys());
        this.logger.log(`🏠 Rooms actives: ${allRooms.join(', ')}`);
      }

      for (const driverUserId of payload.driverUserIds) {
        const userRoom = `user:${driverUserId}`;

        // ✅ Vérifier l'existence de la room uniquement si adapter disponible
        const roomExists = this.server.sockets?.adapter?.rooms.has(userRoom) ?? false;

        this.logger.log(
          `📤 Émission ride.request vers room ${userRoom} (existe: ${roomExists})`
        );

        // ✅ Émettre même si on ne peut pas vérifier les rooms
        this.server.to(userRoom).emit('ride.request', {
          rideId: payload.rideId,
          id: payload.rideId,
          clientName: payload.clientName,
          clientPhone: payload.clientPhone,
          pickupAddress: payload.pickupAddress,
          destinationAddress: payload.destinationAddress,
          pickupLatitude: payload.pickupLatitude,
          pickupLongitude: payload.pickupLongitude,
          destinationLatitude: payload.destinationLatitude,
          destinationLongitude: payload.destinationLongitude,
          totalFare: payload.totalFare,
          baseFare: payload.baseFare,
          amount: payload.totalFare,
          distanceKm: payload.distanceKm,
          durationMinutes: payload.durationMinutes,
          passengerCount: payload.passengerCount,
          rideType: payload.rideType,
          notes: payload.notes,
          status: payload.status,
          requestedAt: payload.requestedAt,
          timestamp: new Date(),
        });

        this.logger.log(` Événement ride.request émis vers ${userRoom}`);
      }
    } catch (error) {
      this.logger.log(` Erreur lors de l'émission ride.request: ${error.message}`, error.stack);
    }
  }

  /**
   * ✅ AMÉLIORATION : ride.accepted avec queue
   */
  @OnEvent('ride.accepted')
  async handleRideAccepted(payload: any) {
    const { rideId, clientId, driverId, driverName } = payload;

    this.logger.log(`📢 Événement ride.accepted reçu pour ride ${rideId}`);

    if (!this.isInitialized || !this.server || !this.server.sockets) {
      this.logger.warn('⏳ Serveur WebSocket non prêt, événement mis en queue');
      this.eventQueue.push({ type: 'ride.accepted', payload });
      return;
    }

    this.emitRideAccepted(payload);
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Extraire logique ride.accepted
   */
  private async emitRideAccepted(payload: any) {
    const { rideId, clientId, driverId, driverName } = payload;

    try {
      // ✅ Vérifier que le serveur existe
      if (!this.server) {
        this.logger.log(' Serveur WebSocket non disponible');
        return;
      }

      const ride = await this.prisma.ride.findUnique({
        where: { id: rideId },
        include: {
          client: { include: { user: true } }
        }
      });

      if (!ride) {
        this.logger.log(`Course ${rideId} non trouvée`);
        return;
      }

      const clientUserId = ride.client.user.id;
      const clientRoomName = `user:${clientUserId}`;

      // ✅ Vérifier l'existence de la room uniquement si adapter disponible
      const roomExists = this.server.sockets?.adapter?.rooms.has(clientRoomName) ?? false;

      this.logger.log(
        `📤 Émission ride.accepted vers room ${clientRoomName} (existe: ${roomExists})`
      );

      // ✅ Émettre l'événement
      this.server.to(clientRoomName).emit('ride.accepted', {
        rideId,
        driverId,
        driverName,
      });

      this.logger.log(` Événement ride.accepted émis vers ${clientRoomName}`);
    } catch (error) {
      this.logger.log(` Erreur handleRideAccepted: ${error.message}`);
    }
  }

  /**
   * ✅ AMÉLIORATION : ride.started avec queue
   */
  @OnEvent('ride.started')
  async handleRideStarted(payload: {
    rideId: string;
    clientId: string;
    driverId: string;
    destination: string;
  }) {
    this.logger.log(`📢 Événement ride.started reçu pour ride ${payload.rideId}`);

    if (!this.isInitialized || !this.server || !this.server.sockets) {
      this.logger.warn('⏳ Serveur WebSocket non prêt, événement mis en queue');
      this.eventQueue.push({ type: 'ride.started', payload });
      return;
    }

    this.emitRideStarted(payload);
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Extraire logique ride.started
   */
  private async emitRideStarted(payload: any) {
    try {
      // ✅ Vérifier que le serveur existe
      if (!this.server) {
        this.logger.log('❌ Serveur WebSocket non disponible');
        return;
      }

      const ride = await this.prisma.ride.findUnique({
        where: { id: payload.rideId },
        include: {
          client: { include: { user: true } },
          driver: { include: { user: true } }
        }
      });

      if (!ride) {
        this.logger.log(`Course ${payload.rideId} non trouvée`);
        return;
      }

      const clientUserId = ride.client.user.id;
      const clientRoom = `user:${clientUserId}`;

      this.logger.log(`📤 Émission ride.started vers ${clientRoom}`);

      this.server.to(clientRoom).emit('ride.started', {
        rideId: payload.rideId,
        destination: payload.destination,
        driverName: `${ride.driver?.user.firstName} ${ride.driver?.user.lastName}`,
        timestamp: new Date(),
      });

      this.logger.log(`✅ Événement ride.started émis vers ${clientRoom}`);

      this.logger.log(`✅ Notification de démarrage envoyée au client`);
    } catch (error) {
      this.logger.log(`Erreur handleRideStarted: ${error.message}`);
    }
  }

  @OnEvent('ride.completed')
  handleRideCompleted(payload: {
    rideId: string;
    clientId: string;
    driverId?: string | null;
    totalFare?: any;
    driverEarnings?: any;
  }) {
    if (!this.isInitialized || !this.server) return;

    this.logger.log(
      `WS ride.completed rideId=${payload.rideId} clientId=${payload.clientId}`,
    );

    this.server.to(`user:${payload.clientId}`).emit('ride.completed', {
      rideId: payload.rideId,
      totalFare: payload.totalFare,
    });

    if (payload.driverId) {
      this.server.to(`user:${payload.driverId}`).emit('ride.completed', {
        rideId: payload.rideId,
        driverEarnings: payload.driverEarnings,
        totalFare: payload.totalFare,
      });
    }
  }

  @OnEvent('ride.canceled')
  handleRideCanceled(payload: {
    rideId: string;
    canceledBy: string;
    reason?: string;
  }) {
    if (!this.isInitialized || !this.server) return;

    this.logger.log(`WS ride.canceled rideId=${payload.rideId}`);

    this.server.emit('ride.canceled', {
      rideId: payload.rideId,
      canceledBy: payload.canceledBy,
      reason: payload.reason,
    });
  }

  @OnEvent('reservation.created')
  handleReservationCreated(payload: {
    reservationId: string;
    clientId: string;
    clientName: string;
    scheduledAt: Date;
    pickupAddress?: string;
    destinationAddress?: string;
    estimatedPrice?: number;
    passengerCount?: number;
  }) {
    if (!this.isInitialized || !this.server) return;

    this.logger.log(
      `WS reservation.created reservationId=${payload.reservationId}`,
    );

    this.server.emit('reservation.new', {
      reservationId: payload.reservationId,
      clientName: payload.clientName,
      scheduledAt: payload.scheduledAt,
      pickupAddress: payload.pickupAddress,
      destinationAddress: payload.destinationAddress,
      estimatedPrice: payload.estimatedPrice,
      passengerCount: payload.passengerCount,
    });
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

    this.logger.log(`✅ User ${data.userId} (${data.role}) authentifié et a rejoint ${userRoom}`);

    const rooms = Array.from(client.rooms);
    this.logger.log(`🏠 Rooms du client ${client.id}: ${rooms.join(', ')}`);

    return {
      success: true,
      userId: data.userId,
      room: userRoom,
      rooms: rooms,
    };
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
    // 1. Réémettre la position en temps réel aux participants de la course
    client.to(`ride-${data.rideId}`).emit('location-updated', {
      rideId: data.rideId,
      latitude: data.latitude,
      longitude: data.longitude,
      heading: data.heading,
      speed: data.speed,
      timestamp: new Date(),
    });

    // 2. Persister la position du chauffeur en BDD
    const userId = this.socketUserMap.get(client.id);
    if (!userId) return;

    try {
      const driverProfile = await this.prisma.driverProfile.findUnique({
        where: { userId },
      });
      if (!driverProfile) return;

      // Mettre à jour DriverLocation (upsert)
      await this.prisma.driverLocation.upsert({
        where: { driverId: driverProfile.id },
        update: {
          latitude: data.latitude,
          longitude: data.longitude,
          heading: data.heading ?? null,
          speed: data.speed ?? null,
          isOnline: true,
          lastPing: new Date(),
        },
        create: {
          driverId: driverProfile.id,
          latitude: data.latitude,
          longitude: data.longitude,
          heading: data.heading ?? null,
          speed: data.speed ?? null,
          isOnline: true,
          isAvailable: true,
        },
      });

      // Enregistrer un point de tracking si la course est EN COURS
      if (data.rideId) {
        const ride = await this.prisma.ride.findUnique({
          where: { id: data.rideId },
          select: { status: true },
        });
        if (ride?.status === 'IN_PROGRESS') {
          await this.prisma.rideTrackingPoint.create({
            data: {
              rideId: data.rideId,
              latitude: data.latitude,
              longitude: data.longitude,
              heading: data.heading ?? null,
              speed: data.speed ?? null,
            },
          });
        }
      }
    } catch (error) {
      this.logger.error(`Erreur sauvegarde position GPS: ${error.message}`);
    }
  }

  @SubscribeMessage('ride-status-change')
  async handleRideStatusChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { rideId: string; status: string; message?: string }
  ) {
    if (!this.isInitialized || !this.server) return;

    this.server.to(`ride-${data.rideId}`).emit('ride-status-changed', {
      rideId: data.rideId,
      status: data.status,
      message: data.message,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong');
    return { success: true };
  }

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
        this.logger.log(`Course ${data.rideId} non trouvée`);
        return;
      }

      const clientUserId = ride.client.user.id;
      const clientRoom = `user:${clientUserId}`;

      this.logger.log(`Émission driver.arrived vers ${clientRoom}`);

      if (this.isInitialized && this.server) {
        this.server.to(clientRoom).emit('driver.arrived', {
          rideId: data.rideId,
          driverId: data.driverId,
          timestamp: data.timestamp,
        });

        this.logger.log(`Notification d'arrivée envoyée au client`);
      }
    } catch (error) {
      this.logger.log(`Erreur handleDriverArrived: ${error.message}`);
    }
  }

  notifyRideUpdate(rideId: string, event: string, data: any) {
    if (!this.isInitialized || !this.server) return;

    this.server.to(`ride-${rideId}`).emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

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

    if (!this.isInitialized || !this.server || !this.server.sockets) {
      this.logger.log('Serveur WebSocket non initialisé, impossible d\'émettre ride.canceled');
      return;
    }

    const cancelData = {
      rideId: payload.rideId,
      canceledBy: payload.canceledBy,
      reason: payload.reason,
      timestamp: new Date(),
    };

    const roomsNotified: string[] = [];

    if (payload.clientId) {
      const clientRoom = `user:${payload.clientId}`;
      this.server.to(clientRoom).emit('ride.canceled', cancelData);
      roomsNotified.push(clientRoom);
      this.logger.log(`Notification envoyée au client: ${clientRoom}`);
    }

    if (payload.driverId) {
      const driverRoom = `user:${payload.driverId}`;
      this.server.to(driverRoom).emit('ride.canceled', cancelData);
      roomsNotified.push(driverRoom);
      this.logger.log(`Notification envoyée au chauffeur: ${driverRoom}`);
    }

    this.logger.log(`Annulation envoyée vers: ${roomsNotified.join(', ')}`);
  }
}