// src/reservations/entities/reservation.entity.ts
import { ApiProperty } from '@nestjs/swagger';
import { ReservationStatus } from '@prisma/client';

export class ReservationEntity {
  @ApiProperty({ example: 'ckxxxxxxxxxxxxxxxxxx' })
  id: string;

  @ApiProperty({ example: 'ckxxxxxxxxxxxxxxxxxx' })
  clientId: string;

  @ApiProperty({ example: '2024-03-15T14:30:00.000Z' })
  scheduledAt: Date;

  @ApiProperty({ enum: ReservationStatus })
  status: ReservationStatus;

  @ApiProperty({ example: 'Cocody Riviera, Abidjan', required: false })
  pickupAddress?: string;

  @ApiProperty({ example: 'Aéroport Félix Houphouët-Boigny', required: false })
  destinationAddress?: string;

  @ApiProperty({ example: 15.5, required: false })
  estimatedDistance?: number;

  @ApiProperty({ example: 3100.00, required: false })
  estimatedPrice?: number;

  @ApiProperty({ example: 2 })
  passengerCount: number;

  @ApiProperty({ example: 'Prévoir siège bébé', required: false })
  notes?: string;

  @ApiProperty({ example: 'ckxxxxxxxxxxxxxxxxxx', required: false })
  rideId?: string;

  @ApiProperty({ example: 'ckxxxxxxxxxxxxxxxxxx', required: false })
  cancellationCauseId?: string;

  @ApiProperty({ example: '2024-03-15T13:25:00.000Z', required: false })
  canceledAt?: Date;

  @ApiProperty({ example: '2024-03-10T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-03-12T15:30:00.000Z' })
  updatedAt: Date;
}
