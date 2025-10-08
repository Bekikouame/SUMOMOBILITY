import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CarpoolPricingService } from './services/carpool-pricing.service';
import { RouteCalculationService } from './services/route-calculation.service';
import { CreateCarpoolReservationDto } from './dto/create-carpool-reservation.dto';
import { SearchCarpoolDto } from './dto/search-carpool.dto';
import { JoinCarpoolDto } from './dto/join-carpool.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CarpoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: CarpoolPricingService,
    private readonly routeService: RouteCalculationService,
  ) {}

  async createCarpoolReservation(dto: CreateCarpoolReservationDto, clientId: string) {
    // 1. Vérifier que l'utilisateur existe et a le bon rôle
    const user = await this.prisma.user.findUnique({
      where: { id: clientId },
      include: { clientProfile: true }
    });

    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }

    if (user.role !== 'CLIENT') {
      throw new BadRequestException('Seuls les clients peuvent créer des réservations');
    }

    // 2. Créer le profil client s'il n'existe pas
    let clientProfile = user.clientProfile;
    if (!clientProfile) {
      clientProfile = await this.prisma.clientProfile.create({
        data: {
          userId: user.id
        }
      });
    }
    
  console.log('=== DEBUG DÉTAILLÉ ===');
  console.log('1. ClientId reçu:', clientId);
  console.log('2. Type:', typeof clientId);
  console.log('3. Longueur:', clientId?.length);
  console.log('4. Est vide/null/undefined:', !clientId);


    // 3. Calculer route et prix (une seule fois)
    const routeData = await this.routeService.getRoute(
      { lat: dto.pickupLatitude, lng: dto.pickupLongitude },
      { lat: dto.destinationLatitude, lng: dto.destinationLongitude }
    );

    // Lister TOUS les utilisateurs pour comparaison
  const allUsers = await this.prisma.user.findMany({
    select: { id: true, email: true, role: true }
  });
  console.log('5. Tous les utilisateurs en DB:', allUsers);


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

  async searchCarpool(dto: SearchCarpoolDto) {
    const timeBuffer = 30; // +/- 30 minutes
    const searchTime = new Date(dto.scheduledAt);
    const radiusKm = dto.radiusKm || 5.0;

    const availableRides = await this.prisma.reservation.findMany({
      where: {
        isSharedRide: true,
        currentSharedPassengers: {
          lt: this.prisma.reservation.fields.maxSharedPassengers
        },
        status: 'CONFIRMED',
        scheduledAt: {
          gte: new Date(searchTime.getTime() - timeBuffer * 60 * 1000),
          lte: new Date(searchTime.getTime() + timeBuffer * 60 * 1000)
        },
        pickupLatitude: {
          not: null,
          gte: dto.pickupLatitude - (radiusKm / 111),
          lte: dto.pickupLatitude + (radiusKm / 111)
        },
        pickupLongitude: {
          not: null,
          gte: dto.pickupLongitude - (radiusKm / 111),
          lte: dto.pickupLongitude + (radiusKm / 111)
        }
      },
      include: {
        client: { include: { user: true } }
      }
    });

    // Calculer compatibilité pour chaque résultat
    const results = await Promise.all(
      availableRides.map(async (ride) => {
        if (!ride.pickupLatitude || !ride.pickupLongitude) {
          return null;
        }

        const compatibility = await this.routeService.calculateRouteCompatibility(ride, dto);
        const distanceToPickup = this.routeService.calculateDistance(
          { lat: dto.pickupLatitude, lng: dto.pickupLongitude },
          { lat: ride.pickupLatitude, lng: ride.pickupLongitude }
        );

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
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter(r => r.compatibility.additionalTime <= (dto.maxDetourMinutes || 20))
      .sort((a, b) => b.compatibility.score - a.compatibility.score);

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
      throw new BadRequestException('Profil client introuvable');
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
    await this.prisma.sharedPassenger.create({
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

      console.log(`✅ ${share.passengerId}: ${share.fareShare} FCFA (${share.percentageOfTrip * 100}% du trajet)`);
    }

    // 6️⃣ Mettre à jour le prix par personne moyen dans la réservation
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

    console.log('✅ Prix recalculés avec succès !');
  }

  /**
   * 📊 Obtenir le résumé détaillé des prix d'un covoiturage
   */
 /**
 * 📊 Obtenir le résumé détaillé des prix d'un covoiturage
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

  // ✅ NOUVEAU : Calculer les revenus du conducteur
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
        
        // ✅ NOUVEAU : Détail financier complet
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
        
        // ✅ Message explicatif amélioré
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
 * 💰 Obtenir le prix ACTUEL d'un passager ou conducteur
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

  // 🚗 Si c'est le CONDUCTEUR
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

  // 👤 Si c'est un PASSAGER
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
}