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

    return {
      success: true,
      reservation,
      pricing: {
        basePrice: basePrice.totalPrice,
        sharedPricePerPerson: carpoolPricing?.pricePerPerson,
        potentialSavings: carpoolPricing?.savingsPerPerson,
        maxPassengers: (dto.maxSharedPassengers || 0) + 1,
        discountPercentage: carpoolPricing?.discountPercentage
      },
      route: {
        distance: routeData.distance,
        duration: routeData.duration
      }
    };
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
    const request = await this.prisma.carpoolRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      throw new NotFoundException('Demande non trouvée');
    }

    if (response.action === 'accept') {
      // Mettre à jour la demande
      await this.prisma.carpoolRequest.update({
        where: { id: requestId },
        data: {
          status: 'ACCEPTED',
          responseMessage: response.message,
          respondedAt: new Date()
        }
      });

      // Créer SharedPassenger
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
          fareShare: request.estimatedFare
        }
      });

      // Incrémenter le nombre de passagers partagés
      await this.prisma.reservation.update({
        where: { id: request.targetReservationId },
        data: {
          currentSharedPassengers: {
            increment: 1
          }
        }
      });

      return { success: true, message: 'Demande acceptée' };
    } else {
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
}