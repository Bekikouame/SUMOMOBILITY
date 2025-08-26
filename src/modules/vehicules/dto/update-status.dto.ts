// src/vehicles/dto/update-status.dto.ts
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VehicleStatus } from '@prisma/client';

export class UpdateVehicleStatusDto {
  @ApiProperty({ 
    description: 'Nouveau statut du véhicule',
    enum: VehicleStatus,
    example: VehicleStatus.AVAILABLE
  })
  @IsEnum(VehicleStatus)
  status: VehicleStatus;
}