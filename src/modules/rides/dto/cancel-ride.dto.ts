// src/modules/rides/dto/cancel-ride.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CancelRideDto {
  @ApiProperty({ description: 'ID de la cause d\'annulation' })
  @IsString()
  cancellationCauseId: string;

  @ApiProperty({ description: 'Qui annule', enum: ['CLIENT', 'DRIVER'] })
  @IsEnum(['CLIENT', 'DRIVER'])
  canceledBy: string;

  @ApiProperty({ description: 'Raison détaillée (optionnelle)', required: false })
  @IsOptional()
  @IsString()
  additionalReason?: string;
}
