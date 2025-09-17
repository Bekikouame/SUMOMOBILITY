import { Injectable } from '@nestjs/common';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface DistanceResult {
  distanceKm: number;
  durationMinutes: number;
}

@Injectable()
export class GeolocationService {
  
  // Calcul distance haversine (à vol d'oiseau)
  calculateDistance(point1: Coordinates, point2: Coordinates): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.deg2rad(point2.latitude - point1.latitude);
    const dLon = this.deg2rad(point2.longitude - point1.longitude);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(point1.latitude)) * Math.cos(this.deg2rad(point2.latitude)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // Vérifier si un point est dans une zone (polygon)
  isPointInZone(point: Coordinates, zoneGeometry: any): boolean {
    const polygon = zoneGeometry.coordinates[0]; // Premier ring du polygon
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i][1] > point.latitude) !== (polygon[j][1] > point.latitude)) &&
          (point.longitude < (polygon[j][0] - polygon[i][0]) * (point.latitude - polygon[i][1]) / (polygon[j][1] - polygon[i][1]) + polygon[i][0])) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  // Estimer durée trajet (approximation simple)
  estimateDuration(distanceKm: number, avgSpeedKmh: number = 30): number {
    return Math.round((distanceKm / avgSpeedKmh) * 60); // en minutes
  }

  // Calculer prix estimé
  calculateEstimatedPrice(
    distanceKm: number, 
    durationMinutes: number,
    baseFare: number,
    perKmRate: number,
    perMinuteRate: number
  ): number {
    return baseFare + (distanceKm * perKmRate) + (durationMinutes * perMinuteRate);
  }
}