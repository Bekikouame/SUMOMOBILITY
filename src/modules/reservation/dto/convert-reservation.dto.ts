// src/reservations/dto/convert-reservation.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class ConvertReservationDto {
  @ApiProperty({ 
    example: 'STANDARD', 
    description: 'Type de course pour la conversion',
    enum: ['STANDARD', 'PREMIUM', 'SHARED', 'VIP'],
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'Le type de course doit être une chaîne' })
  @IsIn(['STANDARD', 'PREMIUM', 'SHARED', 'VIP'], { 
    message: 'Type de course invalide' 
  })
  rideType?: string = 'STANDARD';
}