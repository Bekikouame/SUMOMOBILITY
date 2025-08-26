// src/reservations/dto/reservation-filters.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ReservationStatus } from '@prisma/client';

export class ReservationFiltersDto {
  @ApiProperty({ 
    enum: ReservationStatus, 
    description: 'Filtrer par statut',
    required: false 
  })
  @IsOptional()
  @IsEnum(ReservationStatus, { message: 'Statut de réservation invalide' })
  status?: ReservationStatus;

  @ApiProperty({ 
    example: '2024-03-01T00:00:00.000Z', 
    description: 'Date de début pour filtrer les réservations programmées',
    required: false 
  })
  @IsOptional()
  @IsDateString({}, { message: 'Format de date invalide pour scheduledFrom' })
  scheduledFrom?: string;

  @ApiProperty({ 
    example: '2024-03-31T23:59:59.000Z', 
    description: 'Date de fin pour filtrer les réservations programmées',
    required: false 
  })
  @IsOptional()
  @IsDateString({}, { message: 'Format de date invalide pour scheduledTo' })
  scheduledTo?: string;
}