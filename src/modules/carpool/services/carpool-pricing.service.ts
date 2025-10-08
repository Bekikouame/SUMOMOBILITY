import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PassengerDistanceInfo {
  passengerId: string;
  distanceKm: number;
  percentageOfTotal: number;
}

interface CarpoolPriceCalculation {
  totalDistance: number;
  totalDuration: number;
  baseFare: number;
  distanceCost: number;
  subtotal: number;
  platformFee: number;
  totalPrice: number;
  passengerShares: PassengerShare[];
}

interface PassengerShare {
  passengerId: string;
  distanceKm: number;
  fareShare: number;
  percentageOfTrip: number;
}

interface BasePrice {
  baseFare: number;
  distanceCost: number;
  timeCost: number;
  subtotal: number;
  platformFee: number;
  totalPrice: number;
}

interface DriverEarnings {
  totalCollected: number;
  platformFee: number;
  driverEarnings: number;
  commissionRate: number;
}

@Injectable()
export class CarpoolPricingService {
  private readonly baseFare: number;
  private readonly perKmRate: number;
  private readonly platformCommission: number;

  constructor(private configService: ConfigService) {
    this.baseFare = parseInt(this.configService.get('RIDE_BASE_FARE', '500'));
    this.perKmRate = parseInt(this.configService.get('RIDE_PER_KM_STANDARD', '150'));
    this.platformCommission = parseFloat(this.configService.get('PLATFORM_COMMISSION', '0.15'));
  }

  /**
   * 💰 Calcul du prix de base (CORRIGÉ)
   * Le client paie SEULEMENT le prix du trajet
   * La commission est DÉDUITE des revenus du chauffeur
   */
  calculateBasePrice(distanceKm: number, durationMinutes: number): BasePrice {
    const distanceCost = distanceKm * this.perKmRate;
    const timeCost = 0; // Vous pouvez ajouter un coût temps si besoin
    const subtotal = this.baseFare + distanceCost + timeCost;
    
    // ✅ CORRECTION : Le prix total = subtotal (PAS +15%)
    const totalPrice = subtotal;
    
    // La commission est calculée mais DÉDUITE des revenus du chauffeur
    const platformFee = totalPrice * this.platformCommission;
    
    return {
      baseFare: this.baseFare,
      distanceCost,
      timeCost,
      subtotal,
      platformFee: Math.round(platformFee),
      totalPrice: Math.round(totalPrice)  // Ce que le CLIENT paie
    };
  }

  /**
   * 💰 NOUVELLE MÉTHODE - Calculer les revenus du conducteur
   * 
   * Exemple : 
   * - Total collecté = 2000 FCFA
   * - Commission (15%) = 300 FCFA
   * - Revenus chauffeur = 1700 FCFA
   */
  calculateDriverEarnings(totalCollected: number): DriverEarnings {
    const platformFee = totalCollected * this.platformCommission;
    const driverEarnings = totalCollected - platformFee;
    
    return {
      totalCollected: Math.round(totalCollected),
      platformFee: Math.round(platformFee),
      driverEarnings: Math.round(driverEarnings),
      commissionRate: this.platformCommission
    };
  }

  /**
   * 🎯 Calcul style Yango - Prix partagé proportionnellement
   */
  calculateCarpoolPriceYango(
    totalDistanceKm: number,
    totalDurationMinutes: number,
    passengers: PassengerDistanceInfo[]
  ): CarpoolPriceCalculation {
    
    // 1. Calculer le prix TOTAL du trajet
    const basePrice = this.calculateBasePrice(totalDistanceKm, totalDurationMinutes);

    // 2. Calculer la part de CHAQUE passager selon sa distance
    const passengerShares: PassengerShare[] = passengers.map(passenger => {
      const percentageOfTrip = passenger.distanceKm / totalDistanceKm;
      const fareShare = basePrice.totalPrice * percentageOfTrip;

      return {
        passengerId: passenger.passengerId,
        distanceKm: passenger.distanceKm,
        fareShare: Math.round(fareShare),
        percentageOfTrip: Math.round(percentageOfTrip * 100) / 100
      };
    });

    const totalCollected = passengerShares.reduce((sum, p) => sum + p.fareShare, 0);
    console.log(`✅ Prix total: ${basePrice.totalPrice} FCFA, Collecté: ${totalCollected} FCFA`);

    return {
      totalDistance: totalDistanceKm,
      totalDuration: totalDurationMinutes,
      baseFare: basePrice.baseFare,
      distanceCost: basePrice.distanceCost,
      subtotal: basePrice.subtotal,
      platformFee: basePrice.platformFee,
      totalPrice: basePrice.totalPrice,
      passengerShares
    };
  }

  /**
   * 🧮 Calculer la distance d'un passager
   */
  calculatePassengerDistance(
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number
  ): number {
    const R = 6371;
    const dLat = this.deg2rad(dropoffLat - pickupLat);
    const dLon = this.deg2rad(dropoffLng - pickupLng);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(pickupLat)) * 
      Math.cos(this.deg2rad(dropoffLat)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  /**
   * 🔧 ANCIENNE MÉTHODE - Gardée pour compatibilité
   * Cette méthode utilise l'ancien système avec réduction
   */
  calculateCarpoolPricing(basePrice: BasePrice, numberOfPassengers: number) {
    const dynamicDiscount = Math.min(
      0.25 + (numberOfPassengers - 1) * 0.1,
      0.5
    );

    const discountedPrice = basePrice.totalPrice * (1 - dynamicDiscount);
    const pricePerPerson = discountedPrice / numberOfPassengers;
    const totalSavings = basePrice.totalPrice - discountedPrice;
    const savingsPerPerson = totalSavings / numberOfPassengers;

    return {
      originalPrice: basePrice.totalPrice,
      discountedTotalPrice: Math.round(discountedPrice),
      pricePerPerson: Math.round(pricePerPerson),
      totalSavings: Math.round(totalSavings),
      savingsPerPerson: Math.round(savingsPerPerson),
      discountPercentage: Math.round(dynamicDiscount * 100),
      numberOfPassengers
    };
  }
}