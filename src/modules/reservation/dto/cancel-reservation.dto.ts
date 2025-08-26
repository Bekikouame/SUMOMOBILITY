// src/reservations/dto/cancel-reservation.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CancelReservationDto {
  @ApiProperty({ 
    example: 'ckxxxxxxxxxxxxxxxxxx', 
    description: 'ID de la cause d\'annulation',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'L\'ID de la cause d\'annulation doit être une chaîne' })
  @IsUUID('all', { message: 'Format UUID invalide pour la cause d\'annulation' })
  cancellationCauseId?: string;
}