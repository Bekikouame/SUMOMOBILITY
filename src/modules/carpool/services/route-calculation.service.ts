import { Injectable } from '@nestjs/common';

interface RouteResult {
  distance: number; // en mètres
  duration: number; // en secondes
  status: string;
}

interface Coordinates {
  lat: number;
  lng: number;
}

@Injectable()
export class RouteCalculationService {
  // Calcul distance à vol d'oiseau (Haversine)
  calculateDistance(point1: Coordinates, point2: Coordinates): number {
    const R = 6371; // Rayon de la terre en km
    const dLat = this.deg2rad(point2.lat - point1.lat);
    const dLon = this.deg2rad(point2.lng - point1.lng);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(point1.lat)) * Math.cos(this.deg2rad(point2.lat)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance en km
    return distance;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // Estimation simple durée (30 km/h moyenne en ville)
  async getRoute(origin: Coordinates, destination: Coordinates): Promise<RouteResult> {
    const distance = this.calculateDistance(origin, destination) * 1000; // en mètres
    const duration = (distance / 1000) / 30 * 60 * 60; // 30 km/h = durée en secondes
    
    return {
      distance: Math.round(distance),
      duration: Math.round(duration),
      status: 'OK'
    };
  }

  // Calculer compatibilité de route pour covoiturage
  async calculateRouteCompatibility(
    mainReservation: any, 
    newPassenger: { pickupLatitude: number; pickupLongitude: number; destinationLatitude: number; destinationLongitude: number }
  ): Promise<{ score: number; additionalTime: number; additionalDistance: number }> {
    
    // Route originale
    const originalRoute = await this.getRoute(
      { lat: mainReservation.pickupLatitude, lng: mainReservation.pickupLongitude },
      { lat: mainReservation.destinationLatitude, lng: mainReservation.destinationLongitude }
    );

    // Route avec détour (simplifiée)
    const detourDistance1 = this.calculateDistance(
      { lat: mainReservation.pickupLatitude, lng: mainReservation.pickupLongitude },
      { lat: newPassenger.pickupLatitude, lng: newPassenger.pickupLongitude }
    );

    const detourDistance2 = this.calculateDistance(
      { lat: newPassenger.pickupLatitude, lng: newPassenger.pickupLongitude },
      { lat: newPassenger.destinationLatitude, lng: newPassenger.destinationLongitude }
    );

    const detourDistance3 = this.calculateDistance(
      { lat: newPassenger.destinationLatitude, lng: newPassenger.destinationLongitude },
      { lat: mainReservation.destinationLatitude, lng: mainReservation.destinationLongitude }
    );

    const totalDetourDistance = (detourDistance1 + detourDistance2 + detourDistance3) * 1000;
    const additionalDistance = totalDetourDistance - originalRoute.distance;
    const additionalTime = (additionalDistance / 1000) / 30 * 60; // en minutes

    // Score basé sur détour acceptable
    let score = 0;
    if (additionalTime <= 10) score = 1.0;        // ≤ 10 min: parfait
    else if (additionalTime <= 15) score = 0.8;   // ≤ 15 min: bon
    else if (additionalTime <= 20) score = 0.6;   // ≤ 20 min: acceptable
    else score = 0.3;                              // > 20 min: difficile

    return {
      score,
      additionalTime: Math.round(additionalTime),
      additionalDistance: Math.round(additionalDistance / 1000) // en km
    };
  }
}