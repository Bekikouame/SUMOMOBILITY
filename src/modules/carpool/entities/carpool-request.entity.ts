export class CarpoolRequest {
  id: string;
  requesterId: string;
  targetReservationId: string;
  pickupAddress: string;
  destinationAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destLatitude: number;
  destLongitude: number;
  routeCompatibility?: number;
  additionalDistance?: number;
  additionalTime?: number;
  estimatedFare: number;
  potentialSavings: number;
  status: string;
  requestMessage?: string;
  responseMessage?: string;
  createdAt: Date;
  expiresAt: Date;
}