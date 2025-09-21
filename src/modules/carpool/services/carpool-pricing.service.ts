import { Injectable } from '@nestjs/common';

interface BasePrice {
  baseFare: number;
  distanceCost: number;
  timeCost: number;
  subtotal: number;
  platformFee: number;
  totalPrice: number;
}

interface CarpoolPricing {
  originalPrice: number;
  discountedTotalPrice: number;
  pricePerPerson: number;
  totalSavings: number;
  savingsPerPerson: number;
  discountPercentage: number;
  numberOfPassengers: number;
}

@Injectable()
export class CarpoolPricingService {
  private readonly baseRatePerKm = 500; // 500 FCFA/km
  private readonly baseRatePerMinute = 50; // 50 FCFA/minute
  private readonly baseFare = 1000; // 1000 FCFA de base
  private readonly platformFeeRate = 0.15; // 15% de commission
  private readonly carpoolDiscountRate = 0.25; // 25% de réduction

  calculateBasePrice(distanceKm: number, durationMinutes: number): BasePrice {
    const distanceCost = distanceKm * this.baseRatePerKm;
    const timeCost = durationMinutes * this.baseRatePerMinute;
    const subtotal = this.baseFare + distanceCost + timeCost;
    const platformFee = subtotal * this.platformFeeRate;
    const totalPrice = subtotal + platformFee;

    return {
      baseFare: this.baseFare,
      distanceCost,
      timeCost,
      subtotal,
      platformFee,
      totalPrice: Math.round(totalPrice)
    };
  }

  calculateCarpoolPricing(basePrice: BasePrice, numberOfPassengers: number): CarpoolPricing {
    // Plus il y a de passagers, plus la réduction est importante
    const dynamicDiscount = Math.min(
      this.carpoolDiscountRate + (numberOfPassengers - 1) * 0.1,
      0.5 // Max 50% de réduction
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