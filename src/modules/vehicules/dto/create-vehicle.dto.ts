// src/vehicles/dto/create-vehicle.dto.ts
import { IsString, IsNotEmpty, IsInt, Min, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VehicleStatus } from '@prisma/client';

export class CreateVehicleDto {
  @ApiProperty({ description: 'Numéro de plaque d\'immatriculation', example: 'AB-123-CD' })
  @IsString()
  @IsNotEmpty()
  plateNumber: string;

  @ApiProperty({ description: 'Marque du véhicule', example: 'Toyota' })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty({ description: 'Modèle du véhicule', example: 'Corolla' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({ description: 'Couleur du véhicule', example: 'Blanc' })
  @IsString()
  @IsNotEmpty()
  color: string;

  @ApiProperty({ description: 'Année du véhicule', example: 2020, required: false })
  @IsOptional()
  @IsInt()
  @Min(1900)
  year?: number;

  @ApiProperty({ description: 'Capacité passagers', example: 4, default: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}
