export class SharedPassenger {
  id: string;
  reservationId: string;
  passengerId: string;
  pickupAddress: string;
  destinationAddress: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  destLatitude?: number;
  destLongitude?: number;
  pickupOrder: number;
  dropoffOrder: number;
  fareShare: number;
  paymentStatus: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}