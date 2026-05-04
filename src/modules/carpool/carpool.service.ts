import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CarpoolPricingService } from './services/carpool-pricing.service';
import { RouteCalculationService } from './services/route-calculation.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/services/notifications.service';
import { CreateCarpoolReservationDto } from './dto/create-carpool-reservation.dto';
import { SearchCarpoolDto } from './dto/search-carpool.dto';
import { JoinCarpoolDto } from './dto/join-carpool.dto';
import { Prisma, NotificationType } from '@prisma/client';

import Decimal from 'decimal.js';

@Injectable()
export class CarpoolService {
  private readonly logger = new Logger(CarpoolService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: CarpoolPricingService,
    private readonly routeService: RouteCalculationService,
    private readonly walletService: WalletService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createCarpoolReservation(dto: CreateCarpoolReservationDto, userId: string) {
    // 1. Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        clientProfile: true,
        driverProfile: true
      }
    });

    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }

    // 2. SEULS LES CHAUFFEURS peuvent créer des covoiturages
    if (user.role !== 'DRIVER') {
      throw new BadRequestException('Seuls les chauffeurs peuvent créer des covoiturages. Les clients peuvent rejoindre un covoiturage existant.');
    }

    // 3. Vérifier que le chauffeur est approuvé
    if (!user.driverProfile || user.driverProfile.status !== 'APPROVED') {
      throw new BadRequestException('Votre profil chauffeur doit être approuvé pour créer des covoiturages');
    }

    // 4. Créer ou récupérer le profil client (pour la réservation)
    let clientProfile = user.clientProfile;
    if (!clientProfile) {
      clientProfile = await this.prisma.clientProfile.create({
        data: {
          userId: user.id
        }
      });
    }

  console.log('=== DEBUG CRÉATION COVOITURAGE ===');
  console.log('1. UserId reçu:', userId);
  console.log('2. Rôle:', user.role);
  console.log('3. Profile client créé/existant:', clientProfile.id);


    // 3. Calculer route et prix (une seule fois)
    const routeData = await this.routeService.getRoute(
      { lat: dto.pickupLatitude, lng: dto.pickupLongitude },
      { lat: dto.destinationLatitude, lng: dto.destinationLongitude }
    );

    const basePrice = this.pricingService.calculateBasePrice(
      routeData.distance / 1000, // km
      routeData.duration / 60     // minutes
    );

    // 4. Calculer le prix de covoiturage si applicable
    let carpoolPricing: ReturnType<typeof this.pricingService.calculateCarpoolPricing> | null = null;

    if (dto.isSharedRide && dto.maxSharedPassengers && dto.maxSharedPassengers > 0) {
      carpoolPricing = this.pricingService.calculateCarpoolPricing(
        basePrice,
        dto.maxSharedPassengers + 1
      );
    }

    // ✅ NOUVEAU : Vérifier le solde du wallet AVANT de créer le covoiturage
    const totalFare = basePrice.totalPrice;
    const canCreate = await this.walletService.canAcceptRide(user.driverProfile.id, totalFare);

    if (!canCreate) {
      throw new BadRequestException(
        `Solde insuffisant. Rechargez votre wallet de ${totalFare} FCFA pour créer ce covoiturage.`
      );
    }

    // 5. Créer la réservation
    const reservation = await this.prisma.reservation.create({
      data: {
        clientId: clientProfile.id,
        pickupAddress: dto.pickupAddress,
        destinationAddress: dto.destinationAddress,
        pickupLatitude: dto.pickupLatitude,
        pickupLongitude: dto.pickupLongitude,
        destinationLatitude: dto.destinationLatitude,
        destinationLongitude: dto.destinationLongitude,
        scheduledAt: new Date(dto.scheduledAt),
        notes: dto.notes,
        passengerCount: 1,

        // Champs covoiturage
        isSharedRide: dto.isSharedRide || false,
        maxSharedPassengers: dto.maxSharedPassengers || 0,
        currentSharedPassengers: 0,
        sharePreference: dto.sharePreference,
        maxDetourMinutes: dto.maxDetourMinutes,

        // Calculs financiers
        estimatedDistance: routeData.distance / 1000,
        estimatedPrice: new Decimal(carpoolPricing ? carpoolPricing.pricePerPerson : basePrice.totalPrice),
        basePrice: new Decimal(basePrice.totalPrice),
        sharedPricePerPerson: carpoolPricing ? new Decimal(carpoolPricing.pricePerPerson) : null,
        totalSavings: carpoolPricing ? new Decimal(carpoolPricing.totalSavings) : null,

        status: 'CONFIRMED'
      },
      include: {
        client: { include: { user: true } }
      }
    });

    // ✅ NOUVEAU : Déduire le montant total IMMÉDIATEMENT après la création
    await this.walletService.deductRideFare(user.driverProfile.id, totalFare, reservation.id);
    this.logger.log(`💰 ${totalFare} FCFA déduit du wallet du chauffeur ${user.driverProfile.id} pour covoiturage ${reservation.id}`);

    // 🚗 Créer automatiquement un RIDE pour le covoiturage (le chauffeur est déjà assigné)
    const ride = await this.prisma.ride.create({
      data: {
        clientId: clientProfile.id, // Le client (qui est aussi le chauffeur)
        driverId: user.driverProfile.id, // Le chauffeur assigné
        status: 'ACCEPTED', // Le chauffeur a déjà accepté puisqu'il crée le covoiturage
        pickupAddress: dto.pickupAddress,
        destinationAddress: dto.destinationAddress,
        pickupLatitude: dto.pickupLatitude,
        pickupLongitude: dto.pickupLongitude,
        destinationLatitude: dto.destinationLatitude,
        destinationLongitude: dto.destinationLongitude,
        durationMinutes: Math.round(routeData.duration / 60),
        distanceKm: routeData.distance / 1000,
        totalFare: new Decimal(totalFare),
        baseFare: new Decimal(basePrice.totalPrice),
        acceptedAt: new Date(), // Accepté immédiatement
        requestedAt: new Date(), // Demandé immédiatement
      }
    });
    this.logger.log(`🚗 Ride ${ride.id} créé automatiquement pour le covoiturage ${reservation.id}`);

    // Lier le ride à la réservation
    await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: { rideId: ride.id }
    });
    this.logger.log(`🔗 Ride ${ride.id} lié à la réservation ${reservation.id}`);

    // 📊 Préparer les informations de prix détaillées pour le client
const maxPassengers = dto.maxSharedPassengers || 0;
const totalSeats = maxPassengers + 1; // +1 pour le conducteur

const pricingInfo = {
  // Prix si le client voyage SEUL (aucun passager ne rejoint)
  priceIfAlone: basePrice.totalPrice,
  
  // Prix ESTIMÉ par personne si le covoiturage est COMPLET
  estimatedPricePerPerson: carpoolPricing?.pricePerPerson || basePrice.totalPrice,
  
  // Prix MINIMUM possible (tous les sièges remplis, divisé équitablement)
  minimumPossiblePrice: dto.isSharedRide && maxPassengers > 0
    ? Math.round(basePrice.totalPrice / totalSeats)
    : basePrice.totalPrice,
  
  // Prix MAXIMUM possible (le client voyage seul)
  maximumPossiblePrice: basePrice.totalPrice,
  
  // Économies POTENTIELLES si covoiturage complet
  potentialSavings: carpoolPricing?.savingsPerPerson || 0,
  
  // Nombre de places disponibles
  maxPassengers: totalSeats,
  availableSeats: maxPassengers,
  
  // Message explicatif pour le client
  priceExplanation: dto.isSharedRide && maxPassengers > 0
    ? `Votre prix variera entre ${Math.round(basePrice.totalPrice / totalSeats)} FCFA (si ${maxPassengers} passager(s) rejoignent) et ${basePrice.totalPrice} FCFA (si vous voyagez seul). Le prix final sera calculé selon les distances réelles des passagers.`
    : `Prix fixe: ${basePrice.totalPrice} FCFA (trajet non partagé)`,
  
  // Statut actuel
  currentStatus: 'WAITING_FOR_PASSENGERS',
  currentPassengers: 0
};

// 📢 Envoyer des notifications à tous les clients pour les informer du nouveau covoiturage
if (dto.isSharedRide && maxPassengers > 0) {
  try {
    // Récupérer tous les clients actifs (sauf celui qui crée le covoiturage)
    const clients = await this.prisma.clientProfile.findMany({
      where: {
        userId: { not: userId },
        user: {
          role: 'CLIENT',
          isActive: true
        }
      },
      include: {
        user: true
      }
    });

    this.logger.log(`📢 Envoi de notifications à ${clients.length} clients pour le nouveau covoiturage ${reservation.id}`);

    // Envoyer une notification à chaque client
    for (const client of clients) {
      await this.notificationsService.sendNotification({
        type: NotificationType.NEW_CARPOOL_AVAILABLE,
        userId: client.userId,
        variables: {
          pickupAddress: dto.pickupAddress,
          destinationAddress: dto.destinationAddress,
          scheduledAt: new Date(dto.scheduledAt).toLocaleString('fr-FR'),
          pricePerPerson: carpoolPricing?.pricePerPerson.toString() || basePrice.totalPrice.toString(),
          availableSeats: maxPassengers.toString(),
        },
      });
    }

    this.logger.log(`✅ Notifications envoyées avec succès pour le covoiturage ${reservation.id}`);
  } catch (error) {
    this.logger.error(`❌ Erreur lors de l'envoi des notifications pour le covoiturage ${reservation.id}:`, error);
    // Ne pas bloquer la création du covoiturage si l'envoi des notifications échoue
  }
}

return {
  success: true,
  message: dto.isSharedRide
    ? 'Covoiturage créé avec succès ! Le prix sera ajusté selon les passagers qui rejoindront.'
    : 'Réservation créée avec succès !',
  reservation,
  pricing: pricingInfo,
  route: {
    distance: routeData.distance / 1000, // en km
    duration: routeData.duration / 60,    // en minutes
    estimatedDuration: `${Math.round(routeData.duration / 60)} minutes`
  }
};

    // 📊 Préparer les informations de prix détaillées pour le client
  }

  async searchCarpool(dto: SearchCarpoolDto, userId: string) {
    const timeBuffer = 60 * 24; // +/- 24 heures (élargi pour les tests)
    const searchTime = new Date(dto.scheduledAt);
    const radiusKm = dto.radiusKm || 50.0; // Rayon élargi pour les tests

    this.logger.log(`🔍 Recherche covoiturage pour user ${userId}`);
    this.logger.log(`📍 Position: ${dto.pickupLatitude}, ${dto.pickupLongitude}`);
    this.logger.log(`🕐 Heure recherche: ${searchTime.toISOString()}`);

    // Récupérer le profil client du chercheur
    const clientProfile = await this.prisma.clientProfile.findUnique({
      where: { userId },
    });

    if (!clientProfile) {
      throw new Error('Profil client non trouvé');
    }

    // D'abord, récupérer TOUS les covoiturages disponibles pour debug
    const allCarpools = await this.prisma.reservation.findMany({
      where: {
        isSharedRide: true,
        status: 'CONFIRMED',
      },
      include: {
        client: { include: { user: true } }
      }
    });
    this.logger.log(`📊 Total covoiturages en base: ${allCarpools.length}`);
    allCarpools.forEach(c => {
      this.logger.log(`  - ID: ${c.id}, scheduledAt: ${c.scheduledAt}, maxPassengers: ${c.maxSharedPassengers}, current: ${c.currentSharedPassengers}`);
    });

    const availableRides = await this.prisma.reservation.findMany({
      where: {
        isSharedRide: true,
        status: 'CONFIRMED',
        // Exclure les covoiturages créés par le chercheur lui-même
        clientId: {
          not: clientProfile.id
        },
        // Vérifier qu'il reste des places (comparaison manuelle plus tard)
        maxSharedPassengers: {
          gt: 0
        },
        scheduledAt: {
          gte: new Date(searchTime.getTime() - timeBuffer * 60 * 1000),
          lte: new Date(searchTime.getTime() + timeBuffer * 60 * 1000)
        },
      },
      include: {
        client: { include: { user: true } }
      }
    });

    this.logger.log(`🚗 Covoiturages trouvés après filtre temps: ${availableRides.length}`);

    // Filtrer manuellement ceux qui ont encore des places
    const ridesWithSeats = availableRides.filter(r => r.currentSharedPassengers < r.maxSharedPassengers);
    this.logger.log(`🪑 Covoiturages avec places disponibles: ${ridesWithSeats.length}`);

    // Calculer compatibilité pour chaque résultat
    const results = await Promise.all(
      ridesWithSeats.map(async (ride) => {
        if (!ride.pickupLatitude || !ride.pickupLongitude) {
          this.logger.log(`⚠️ Ride ${ride.id} ignoré: pas de coordonnées`);
          return null;
        }

        const compatibility = await this.routeService.calculateRouteCompatibility(ride, dto);
        const distanceToPickup = this.routeService.calculateDistance(
          { lat: dto.pickupLatitude, lng: dto.pickupLongitude },
          { lat: ride.pickupLatitude, lng: ride.pickupLongitude }
        );

        this.logger.log(`📏 Ride ${ride.id}: distance=${distanceToPickup.toFixed(2)}km, additionalTime=${compatibility.additionalTime}min`);

        return {
          reservation: ride,
          compatibility,
          distanceToPickup: Math.round(distanceToPickup * 1000),
          estimatedFare: ride.sharedPricePerPerson ? Number(ride.sharedPricePerPerson) : Number(ride.basePrice || ride.estimatedPrice),
          availableSeats: ride.maxSharedPassengers - ride.currentSharedPassengers,
          savings: Number(ride.basePrice || 0) - Number(ride.sharedPricePerPerson || ride.basePrice || 0)
        };
      })
    );

    const compatibleResults = results
      .filter((r): r is NonNullable<typeof r> => r !== null);
    // Temporairement désactivé le filtre de temps additionnel pour debug
    // .filter(r => r.compatibility.additionalTime <= (dto.maxDetourMinutes || 20))

    compatibleResults.sort((a, b) => b.compatibility.score - a.compatibility.score);

    this.logger.log(`✅ Résultats finaux: ${compatibleResults.length} covoiturages compatibles`);

    return {
      success: true,
      results: compatibleResults,
      total: compatibleResults.length
    };
  }

  async joinCarpool(dto: JoinCarpoolDto, userId: string) {
    // 1. Obtenir le profil client du demandeur
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { clientProfile: true }
    });

    if (!user?.clientProfile) {
      throw new BadRequestException('Profil client introuvable');
    }

    // 2. Vérifier disponibilité de la réservation
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: dto.reservationId }
    });

    if (!reservation?.isSharedRide) {
      throw new NotFoundException('Covoiturage non trouvé');
    }

    if (reservation.currentSharedPassengers >= reservation.maxSharedPassengers) {
      throw new BadRequestException('Covoiturage complet');
    }

    // 3. Calculer compatibilité
    const compatibility = await this.routeService.calculateRouteCompatibility(reservation, dto);

    // 4. Calculs prix avec vérifications
    const basePrice = Number(reservation.basePrice || reservation.estimatedPrice || 0);
    const sharedPrice = Number(reservation.sharedPricePerPerson || basePrice);
    
    // 5. Créer demande avec l'ID du ClientProfile
    const request = await this.prisma.carpoolRequest.create({
      data: {
        requesterId: user.clientProfile.id, // Utiliser l'ID du ClientProfile
        targetReservationId: dto.reservationId,
        pickupAddress: dto.pickupAddress,
        destinationAddress: dto.destinationAddress,
        pickupLatitude: dto.pickupLatitude,
        pickupLongitude: dto.pickupLongitude,
        destLatitude: dto.destinationLatitude,
        destLongitude: dto.destinationLongitude,
        routeCompatibility: compatibility.score,
        additionalDistance: compatibility.additionalDistance,
        additionalTime: compatibility.additionalTime,
        estimatedFare: new Decimal(sharedPrice),
        potentialSavings: new Decimal(basePrice - sharedPrice),
        requestMessage: dto.message,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });

    return {
      success: true,
      request,
      estimatedFare: sharedPrice,
      compatibility
    };
  }

  async getUserCarpoolRequests(userId: string) {
    // Obtenir l'ID du ClientProfile
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { clientProfile: true }
    });

    if (!user?.clientProfile) {
      // Retourner un tableau vide au lieu de lancer une erreur
      return {
        success: true,
        requests: []
      };
    }

    const requests = await this.prisma.carpoolRequest.findMany({
      where: { requesterId: user.clientProfile.id },
      include: {
        targetReservation: {
          include: {
            client: { include: { user: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      success: true,
      requests
    };
  }

  async getDriverPendingRequests(driverId: string) {
    const requests = await this.prisma.carpoolRequest.findMany({
      where: {
        status: 'PENDING',
        targetReservation: {
          ride: {
            driverId: driverId
          }
        }
      },
      include: {
        requester: { 
          include: { user: true } 
        },
        targetReservation: true
      }
    });

    return {
      success: true,
      requests: requests.map(request => ({
        id: request.id,
        pickupAddress: request.pickupAddress,
        estimatedFare: Number(request.estimatedFare),
        estimatedEarnings: Math.round(Number(request.estimatedFare) * 0.85),
        passengerName: request.requester.user.firstName,
        message: request.requestMessage
      }))
    };
  }

  async respondToRequest(
  requestId: string, 
  response: { action: 'accept' | 'reject', message?: string },
  driverId: string
) {
  console.log('=== SERVICE DEBUG ===');
  console.log('Request ID:', requestId);
  console.log('Driver ID:', driverId);
  console.log('Response:', response);

  const request = await this.prisma.carpoolRequest.findUnique({
    where: { id: requestId },
    include: {
      targetReservation: true
    }
  });

  console.log('Request trouvé:', request ? 'OUI' : 'NON');
  console.log('Request data:', request);

  if (!request) {
    console.log('ERREUR: Aucune demande trouvée avec ID:', requestId);
    throw new NotFoundException('Demande non trouvée');
  }

  if (response.action === 'accept') {
    // 1️⃣ Mettre à jour la demande
    await this.prisma.carpoolRequest.update({
      where: { id: requestId },
      data: {
        status: 'ACCEPTED',
        responseMessage: response.message,
        respondedAt: new Date()
      }
    });

    // 2️⃣ Créer SharedPassenger avec fareShare = 0 (temporaire)
    const sharedPassenger = await this.prisma.sharedPassenger.create({
      data: {
        reservationId: request.targetReservationId,
        passengerId: request.requesterId,
        pickupAddress: request.pickupAddress,
        destinationAddress: request.destinationAddress,
        pickupLatitude: request.pickupLatitude,
        pickupLongitude: request.pickupLongitude,
        destLatitude: request.destLatitude,
        destLongitude: request.destLongitude,
        pickupOrder: 2,
        dropoffOrder: 2,
        fareShare: 0,  // ⚠️ CHANGÉ: Temporaire, sera recalculé
        status: 'CONFIRMED'  // Ajoutez cette ligne si le champ status existe
      }
    });

    // 3️⃣ Incrémenter le nombre de passagers partagés
    await this.prisma.reservation.update({
      where: { id: request.targetReservationId },
      data: {
        currentSharedPassengers: {
          increment: 1
        }
      }
    });

    // 4️⃣ 🎯 NOUVEAU - Recalculer TOUS les prix avec le modèle Yango
    try {
      console.log('🔄 Lancement du recalcul des prix Yango...');
      await this.recalculateCarpoolPricesYango(request.targetReservationId);
      console.log('✅ Prix recalculés avec succès !');
    } catch (error) {
      console.error('❌ Erreur lors du recalcul des prix:', error);
      // On continue quand même, le prix sera recalculé plus tard si nécessaire
    }

    // 5️⃣ 🚗 CRÉER UN RIDE pour le passager accepté
    // Récupérer le ride principal du covoiturage
    const mainReservation = await this.prisma.reservation.findUnique({
      where: { id: request.targetReservationId },
      include: {
        ride: true,
        client: {
          include: { user: true }
        }
      }
    });

    // Récupérer les infos du passager
    const passengerClient = await this.prisma.clientProfile.findUnique({
      where: { id: request.requesterId },
      include: { user: true }
    });

    if (mainReservation?.ride && passengerClient) {
      this.logger.log(`🚗 Création d'un ride pour le passager ${request.requesterId}`);

      // Le ride du passager partage le même chauffeur que le ride principal
      const passengerRide = await this.prisma.ride.create({
        data: {
          clientId: request.requesterId, // Le passager devient le client de ce ride
          driverId: mainReservation.ride.driverId, // Même chauffeur
          status: 'ACCEPTED',
          pickupAddress: request.pickupAddress,
          destinationAddress: request.destinationAddress,
          pickupLatitude: request.pickupLatitude,
          pickupLongitude: request.pickupLongitude,
          destinationLatitude: request.destLatitude,
          destinationLongitude: request.destLongitude,
          totalFare: sharedPassenger.fareShare, // Le prix partagé
          baseFare: sharedPassenger.fareShare,
          acceptedAt: new Date(),
          requestedAt: new Date(),
        }
      });

      this.logger.log(`✅ Ride ${passengerRide.id} créé pour le passager du covoiturage`);

      // 6️⃣ 📢 Envoyer une notification au passager
      try {
        await this.notificationsService.sendNotification({
          type: NotificationType.RIDE_ACCEPTED,
          userId: passengerClient.userId,
          variables: {
            driverName: `${mainReservation.client.user.firstName} ${mainReservation.client.user.lastName}`,
            pickupAddress: request.pickupAddress,
            destinationAddress: request.destinationAddress,
            fare: sharedPassenger.fareShare.toString(),
            rideId: passengerRide.id,
          }
        });
        this.logger.log(`📢 Notification envoyée au passager ${passengerClient.userId}`);
      } catch (error) {
        this.logger.error(`❌ Erreur envoi notification au passager:`, error);
      }
    } else {
      this.logger.warn(`⚠️ Pas de ride principal trouvé pour créer le ride passager`);
    }

    return {
      success: true,
      message: 'Demande acceptée et prix recalculés selon le modèle Yango'
    };

  } else {
    // Rejeter la demande
    await this.prisma.carpoolRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        responseMessage: response.message,
        respondedAt: new Date()
      }
    });

    return { success: true, message: 'Demande refusée' };
  }
}

  async getReservationTracking(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        sharedPassengers: {
          include: {
            passenger: { include: { user: true } }
          }
        }
      }
    });

    if (!reservation) {
      return {
        success: false,
        message: 'Réservation non trouvée'
      };
    }

    return {
      success: true,
      tracking: {
        status: reservation.status,
        scheduledAt: reservation.scheduledAt,
        totalPassengers: 1 + reservation.sharedPassengers.length,
        passengers: reservation.sharedPassengers.map(sp => ({
          name: sp.passenger.user.firstName,
          pickupAddress: sp.pickupAddress
        }))
      }
    };
  }

  /**
   * 🎯 NOUVELLE MÉTHODE - Recalculer tous les prix selon le modèle Yango
   * 
   * À appeler :
   * - Après acceptation d'une demande de covoiturage
   * - Si un passager annule
   * - Avant finalisation des paiements
   */
 /**
   * 
   */
  async recalculateCarpoolPricesYango(reservationId: string): Promise<void> {
    console.log(`🔄 Recalcul des prix pour reservation ${reservationId}...`);

    // 1️⃣ Récupérer la réservation principale
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        sharedPassengers: {
          where: { status: 'CONFIRMED' }
        }
      }
    });

    if (!reservation) {
      throw new NotFoundException('Réservation non trouvée');
    }

    if (!reservation.isSharedRide) {
      throw new BadRequestException('Cette réservation n\'est pas un covoiturage');
    }

    //  VÉRIFICATION : Les coordonnées GPS sont obligatoires
    if (!reservation.pickupLatitude || !reservation.pickupLongitude || 
        !reservation.destinationLatitude || !reservation.destinationLongitude) {
      throw new BadRequestException('Coordonnées GPS manquantes pour la réservation');
    }

    const passengers = reservation.sharedPassengers;

    if (passengers.length === 0) {
      console.log('⚠️ Aucun passager partagé, pas de recalcul nécessaire');
      return;
    }

    // 2 Calculer la distance totale du trajet
    const totalRoute = await this.routeService.getRoute(
      { 
        lat: reservation.pickupLatitude,   //  Maintenant TypeScript sait que ce n'est pas null
        lng: reservation.pickupLongitude 
      },
      { 
        lat: reservation.destinationLatitude, 
        lng: reservation.destinationLongitude 
      }
    );

    const totalDistanceKm = totalRoute.distance / 1000;
    const totalDurationMin = totalRoute.duration / 60;

    console.log(` Distance totale: ${totalDistanceKm} km`);

    // 3️ Calculer la distance de CHAQUE passager
    const passengerDistances = passengers
      .filter(passenger => 
        //  On filtre les passagers qui ont toutes leurs coordonnées
        passenger.pickupLatitude !== null && 
        passenger.pickupLongitude !== null &&
        passenger.destLatitude !== null &&
        passenger.destLongitude !== null
      )
      .map(passenger => {
        //  TypeScript sait maintenant que ces valeurs ne sont pas null
        const distance = this.pricingService.calculatePassengerDistance(
          passenger.pickupLatitude!,  // Le "!" dit à TypeScript "je suis sûr que ce n'est pas null"
          passenger.pickupLongitude!,
          passenger.destLatitude!,
          passenger.destLongitude!
        );

        console.log(`👤 Passager ${passenger.passengerId}: ${distance} km (${Math.round(distance/totalDistanceKm*100)}% du trajet)`);

        return {
          passengerId: passenger.passengerId,
          distanceKm: distance,
          percentageOfTotal: distance / totalDistanceKm
        };
      });

    if (passengerDistances.length === 0) {
      throw new BadRequestException('Aucun passager avec coordonnées GPS valides');
    }

    // 4️⃣ Calculer avec la méthode Yango
    const priceCalculation = this.pricingService.calculateCarpoolPriceYango(
      totalDistanceKm,
      totalDurationMin,
      passengerDistances
    );

    console.log(`💰 Prix total du trajet: ${priceCalculation.totalPrice} FCFA`);

    // 5️⃣ Mettre à jour la part de chaque passager
    for (const share of priceCalculation.passengerShares) {
      await this.prisma.sharedPassenger.updateMany({
        where: { 
          reservationId,
          passengerId: share.passengerId
        },
        data: { 
          fareShare: share.fareShare
        }
      });

      console.log(` ${share.passengerId}: ${share.fareShare} FCFA (${share.percentageOfTrip * 100}% du trajet)`);
    }

    // 6️Mettre à jour le prix par personne moyen dans la réservation
    const avgPricePerPerson = Math.round(
      priceCalculation.passengerShares.reduce((sum, p) => sum + p.fareShare, 0) / 
      priceCalculation.passengerShares.length
    );

    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        sharedPricePerPerson: avgPricePerPerson
      }
    });

    console.log(' Prix recalculés avec succès !');
  }

  /**
   * Obtenir le résumé détaillé des prix d'un covoiturage
   */
 /**
 * Obtenir le résumé détaillé des prix d'un covoiturage
 * Accessible par : Conducteur (voit tout) + Passagers (voient leur prix)
 */
async getCarpoolPricingSummary(reservationId: string, requestingUserId: string) {
  const reservation = await this.prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      sharedPassengers: {
        where: { status: 'CONFIRMED' },
        include: {
          passenger: { include: { user: true } }
        }
      },
      client: { include: { user: true } }
    }
  });

  if (!reservation) {
    throw new NotFoundException('Réservation non trouvée');
  }

  const isDriver = reservation.client.userId === requestingUserId;
  const isPassenger = reservation.sharedPassengers.some(
    p => p.passenger.userId === requestingUserId
  );

  if (!isDriver && !isPassenger) {
    throw new BadRequestException('Vous n\'avez pas accès à ces informations');
  }

  const passengers = reservation.sharedPassengers;
  const totalCollected = passengers.reduce((sum, p) => sum + Number(p.fareShare), 0);
  const basePriceTotal = Number(reservation.basePrice);

  // NOUVEAU : Calculer les revenus du conducteur
  const earnings = this.pricingService.calculateDriverEarnings(totalCollected);

  // Vue CONDUCTEUR
  if (isDriver) {
    return {
      success: true,
      role: 'DRIVER',
      reservationId,
      tripStatus: reservation.status,
      driver: {
        name: `${reservation.client.user.firstName} ${reservation.client.user.lastName}`,
        email: reservation.client.user.email
      },
      route: {
        from: reservation.pickupAddress,
        to: reservation.destinationAddress,
        totalDistance: reservation.estimatedDistance,
        scheduledAt: reservation.scheduledAt
      },
      pricing: {
        basePriceTotal,
        
        //  NOUVEAU : Détail financier complet
        totalCollected: earnings.totalCollected,
        platformFee: earnings.platformFee,
        platformCommissionRate: `${earnings.commissionRate * 100}%`,
        driverEarnings: earnings.driverEarnings,
        
        numberOfPassengers: passengers.length,
        availableSeats: reservation.maxSharedPassengers - reservation.currentSharedPassengers,
        
        passengers: passengers.map(p => ({
          id: p.passengerId,
          name: `${p.passenger.user.firstName} ${p.passenger.user.lastName}`,
          phone: p.passenger.user.phone,
          pickupAddress: p.pickupAddress,
          destinationAddress: p.destinationAddress,
          fareShare: Number(p.fareShare),
          paymentStatus: p.paymentStatus,
          pickupOrder: p.pickupOrder
        })),
        
        //  Message explicatif amélioré
        message: passengers.length === 0 
          ? `Aucun passager pour le moment. En attente...`
          : `Vous collecterez ${earnings.totalCollected} FCFA auprès de ${passengers.length} passager(s). Commission plateforme: ${earnings.platformFee} FCFA (${earnings.commissionRate * 100}%). Vos gains nets: ${earnings.driverEarnings} FCFA.`
      }
    };
  }

  // Vue PASSAGER
  const passengerData = passengers.find(p => p.passenger.userId === requestingUserId);
  
  if (!passengerData) {
    throw new NotFoundException('Informations passager non trouvées');
  }

  return {
    success: true,
    role: 'PASSENGER',
    reservationId,
    tripStatus: reservation.status,
    driver: {
      name: `${reservation.client.user.firstName} ${reservation.client.user.lastName}`,
      phone: reservation.client.user.phone
    },
    route: {
      from: reservation.pickupAddress,
      to: reservation.destinationAddress,
      totalDistance: reservation.estimatedDistance,
      scheduledAt: reservation.scheduledAt
    },
    myBooking: {
      pickupAddress: passengerData.pickupAddress,
      destinationAddress: passengerData.destinationAddress,
      myFareShare: Number(passengerData.fareShare),
      paymentStatus: passengerData.paymentStatus,
      pickupOrder: passengerData.pickupOrder,
      otherPassengersCount: passengers.length - 1,
      totalPassengers: passengers.length + 1,
      message: `Vous paierez ${Number(passengerData.fareShare)} FCFA pour ce trajet partagé.`
    }
  };
}
/**
 *  Obtenir le prix ACTUEL d'un passager ou conducteur
 * Utile pour afficher le prix en temps réel dans l'app
 */
async getMyCurrentPrice(reservationId: string, userId: string) {
  const reservation = await this.prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      sharedPassengers: {
        where: { status: 'CONFIRMED' },
        include: { passenger: { include: { user: true } } }
      },
      client: { include: { user: true } }
    }
  });

  if (!reservation) {
    throw new NotFoundException('Réservation non trouvée');
  }

  const isDriver = reservation.client.userId === userId;
  const passengers = reservation.sharedPassengers;
  const basePriceTotal = Number(reservation.basePrice);

  //  Si c'est le CONDUCTEUR
  if (isDriver) {
    const totalCollected = passengers.reduce((sum, p) => sum + Number(p.fareShare), 0);
    
    return {
      success: true,
      role: 'DRIVER',
      status: reservation.status,
      pricing: {
        // Si aucun passager n'a rejoint
        willPayIfAlone: passengers.length === 0 ? basePriceTotal : 0,
        
        // Ce que le conducteur va collecter
        totalToCollect: totalCollected,
        
        // Ses gains nets (après commission 15%)
        netEarnings: Math.round(totalCollected * 0.85),
        
        // Nombre de passagers actuels
        currentPassengers: passengers.length,
        
        // Places restantes
        seatsAvailable: reservation.maxSharedPassengers - passengers.length,
        
        // Message
        message: passengers.length === 0
          ? `Aucun passager pour le moment. Vous paierez ${basePriceTotal} FCFA si personne ne rejoint.`
          : `${passengers.length} passager(s) ont rejoint. Vous collecterez ${totalCollected} FCFA (gains nets : ${Math.round(totalCollected * 0.85)} FCFA).`
      }
    };
  }

  //  Si c'est un PASSAGER
  const passengerData = passengers.find(p => p.passenger.userId === userId);
  
  if (!passengerData) {
    throw new BadRequestException('Vous n\'êtes pas passager de ce covoiturage');
  }

  return {
    success: true,
    role: 'PASSENGER',
    status: reservation.status,
    pricing: {
      myFareShare: Number(passengerData.fareShare),
      paymentStatus: passengerData.paymentStatus,
      tripDistance: `${passengerData.pickupAddress} → ${passengerData.destinationAddress}`,

      // Message
      message: `Votre part : ${Number(passengerData.fareShare)} FCFA pour ce trajet partagé.`
    }
  };
}

/**
 * Récupérer les rides des passagers d'un covoiturage
 */
async getCarpoolPassengerRides(reservationId: string) {
  const reservation = await this.prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      sharedPassengers: {
        include: {
          passenger: {
            include: { user: true }
          }
        }
      }
    }
  });

  if (!reservation) {
    throw new NotFoundException('Covoiturage non trouvé');
  }

  // Récupérer tous les rides des passagers
  const passengerIds = reservation.sharedPassengers.map(p => p.passengerId);

  const rides = await this.prisma.ride.findMany({
    where: {
      clientId: { in: passengerIds },
      status: { in: ['ACCEPTED', 'IN_PROGRESS'] }
    },
    include: {
      client: {
        include: { user: true }
      }
    },
    orderBy: {
      createdAt: 'asc' // Premier arrivé, premier servi
    }
  });

  return rides.map(ride => ({
    rideId: ride.id,
    passengerId: ride.clientId,
    passengerName: `${ride.client.user.firstName} ${ride.client.user.lastName}`,
    passengerPhone: ride.client.user.phone,
    pickupAddress: ride.pickupAddress,
    pickupLatitude: ride.pickupLatitude,
    pickupLongitude: ride.pickupLongitude,
    destinationAddress: ride.destinationAddress,
    status: ride.status,
  }));
}

/**
 * Obtenir les covoiturages actifs du chauffeur
 */
async getDriverActiveCarpools(driverId: string) {
  // Récupérer le profil du chauffeur pour trouver ses réservations
  const driver = await this.prisma.driverProfile.findUnique({
    where: { id: driverId },
    select: { userId: true }
  });

  if (!driver) {
    return [];
  }

  // Trouver les covoiturages actifs assignés à CE chauffeur
  const reservations = await this.prisma.reservation.findMany({
    where: {
      isSharedRide: true,
      status: { in: ['PENDING', 'CONFIRMED'] },
      scheduledAt: { gte: new Date() }, // seulement à venir
      ride: { driverId },               // assignés à CE chauffeur
    },
    include: {
      ride: true,
      sharedPassengers: {
        where: {
          status: 'CONFIRMED'
        },
        include: {
          passenger: {
            include: {
              user: true
            }
          }
        }
      },
      client: {
        include: {
          user: true
        }
      }
    }
  });

  const activeCarpools = reservations.map(reservation => {
    // Calculer les gains à partir des passagers confirmés
    const totalEarnings = (reservation.sharedPassengers || []).reduce(
      (sum, p) => sum + Number(p.fareShare),
      0
    );

    return {
      id: reservation.id,
      pickupAddress: reservation.pickupAddress,
      destinationAddress: reservation.destinationAddress,
      pickupLatitude: reservation.pickupLatitude,
      pickupLongitude: reservation.pickupLongitude,
      destinationLatitude: reservation.destinationLatitude,
      destinationLongitude: reservation.destinationLongitude,
      scheduledTime: reservation.scheduledAt,
      maxPassengers: reservation.maxSharedPassengers,
      confirmedPassengers: (reservation.sharedPassengers || []).map(p => ({
        id: p.id,
        pickupAddress: p.pickupAddress,
        destinationAddress: p.destinationAddress,
        pickupLatitude: p.pickupLatitude,
        pickupLongitude: p.pickupLongitude,
        destinationLatitude: p.destLatitude,
        destinationLongitude: p.destLongitude,
        fareShare: Number(p.fareShare),
        status: p.status,
        passenger: {
          user: {
            firstName: p.passenger.user.firstName,
            lastName: p.passenger.user.lastName,
            phone: p.passenger.user.phone
          }
        }
      })),
      totalEarnings: Math.round(totalEarnings * 0.85), // 85% pour le chauffeur
      status: reservation.status,
      rideStatus: reservation.ride?.status || null
    };
  });

  return activeCarpools;
}
}