// src/modules/rides/dto/create-ride.dto.ts
import { IsNumber, IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRideDto {
  @ApiProperty({ description: 'Latitude du point de départ' })
  @IsNumber()
  pickupLatitude: number;

  @ApiProperty({ description: 'Longitude du point de départ' })
  @IsNumber()
  pickupLongitude: number;

  @ApiProperty({ description: 'Latitude de destination' })
  @IsNumber()
  destinationLatitude: number;

  @ApiProperty({ description: 'Longitude de destination' })
  @IsNumber()
  destinationLongitude: number;

  @ApiProperty({ description: 'Adresse de départ', required: false })
  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @ApiProperty({ description: 'Adresse de destination', required: false })
  @IsOptional()
  @IsString()
  destinationAddress?: string;

  @ApiProperty({ description: 'Type de véhicule', enum: ['STANDARD', 'PREMIUM', 'VIP'], required: false })
  @IsOptional()
  @IsString()
  @IsIn(['STANDARD', 'PREMIUM', 'VIP'])
  rideType?: string;

  @ApiProperty({ description: 'Nombre de passagers', required: false })
  @IsOptional()
  @IsNumber()
  passengerCount?: number;

  @ApiProperty({ description: 'Notes supplémentaires', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  // OBLIGATOIRE - RETIRER @IsOptional()
  @ApiProperty({ description: 'Prix accepté par le client après estimation' })
  @IsNumber()
  acceptedFare: number; // Plus d'interrogation, plus d'@IsOptional()

  @ApiProperty({ description: 'ID de l\'estimation pour traçabilité', required: false })
  @IsOptional()
  @IsString()
  estimationId?: string;
}