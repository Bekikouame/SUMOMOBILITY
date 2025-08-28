// src/payments/utils/payment-calculator.ts
export class PaymentCalculator {
  private static PLATFORM_FEE_RATE = 0.15; // 15% de commission plateforme
  private static VAT_RATE = 0.18; // 18% TVA (Côte d'Ivoire)

  static calculateRideFare(
    distanceKm: number,
    durationMinutes: number,
    rideType: string = 'STANDARD'
  ) {
    const baseFare = this.getBaseFareByType(rideType);
    const perKmRate = this.getPerKmRate(rideType);
    const perMinuteRate = this.getPerMinuteRate(rideType);

    const distanceFare = distanceKm * perKmRate;
    const timeFare = durationMinutes * perMinuteRate;
    const subtotal = baseFare + distanceFare + timeFare;
    
    // Tarif minimum
    const minimumFare = this.getMinimumFare(rideType);
    const totalFare = Math.max(subtotal, minimumFare);

    const platformFee = totalFare * this.PLATFORM_FEE_RATE;
    const driverEarnings = totalFare - platformFee;

    return {
      baseFare,
      distanceFare,
      timeFare,
      totalFare: Math.round(totalFare),
      platformFee: Math.round(platformFee),
      driverEarnings: Math.round(driverEarnings),
      breakdown: {
        baseFare: Math.round(baseFare),
        distanceKm,
        distanceFare: Math.round(distanceFare),
        durationMinutes,
        timeFare: Math.round(timeFare),
      }
    };
  }

  private static getBaseFareByType(rideType: string): number {
    const fares = {
      'STANDARD': 500,    // 500 FCFA
      'PREMIUM': 800,     // 800 FCFA
      'SHARED': 300,      // 300 FCFA
      'VAN': 1000,        // 1000 FCFA (pour groupes)
    };
    return fares[rideType] || fares['STANDARD'];
  }

  private static getPerKmRate(rideType: string): number {
    const rates = {
      'STANDARD': 200,    // 200 FCFA/km
      'PREMIUM': 350,     // 350 FCFA/km
      'SHARED': 150,      // 150 FCFA/km
      'VAN': 250,         // 250 FCFA/km
    };
    return rates[rideType] || rates['STANDARD'];
  }

  private static getPerMinuteRate(rideType: string): number {
    const rates = {
      'STANDARD': 50,     // 50 FCFA/min
      'PREMIUM': 80,      // 80 FCFA/min
      'SHARED': 30,       // 30 FCFA/min
      'VAN': 60,          // 60 FCFA/min
    };
    return rates[rideType] || rates['STANDARD'];
  }

  private static getMinimumFare(rideType: string): number {
    const minimums = {
      'STANDARD': 1000,   // 1000 FCFA minimum
      'PREMIUM': 1500,    // 1500 FCFA minimum
      'SHARED': 800,      // 800 FCFA minimum
      'VAN': 2000,        // 2000 FCFA minimum
    };
    return minimums[rideType] || minimums['STANDARD'];
  }

  static calculateCancellationFee(
    canceledBy: 'CLIENT' | 'DRIVER',
    rideStatus: string,
    timeSinceAccepted?: number
  ): number {
    if (canceledBy === 'DRIVER') {
      // Pénalité pour le chauffeur (déduite de ses gains futurs)
      return 0; // Pas de frais pour le client
    }

    // Annulation par le client
    if (rideStatus === 'REQUESTED') {
      return 0; // Gratuit avant acceptation
    }

    if (rideStatus === 'ACCEPTED' && timeSinceAccepted) {
      if (timeSinceAccepted < 300) { // Moins de 5 minutes
        return 0;
      } else if (timeSinceAccepted < 900) { // Entre 5 et 15 minutes
        return 500; // 500 FCFA
      } else {
        return 1000; // 1000 FCFA après 15 minutes
      }
    }

    if (rideStatus === 'IN_PROGRESS') {
      return 2000; // 2000 FCFA si déjà en cours
    }

    return 0;
  }
}
