// src/modules/rides/dto/create-ride.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsInt, Min, Max, IsEnum } from 'class-validator';

export class CreateRideDto {
  @ApiProperty({ 
    description: 'Type de course',
    enum: ['STANDARD', 'PREMIUM', 'SHARED', 'VIP'],
    required: false 
  })
  @IsOptional()
  @IsString()
  rideType?: string;

  @ApiProperty({ description: 'Adresse de prise en charge' })
  @IsString()
  pickupAddress: string;

  @ApiProperty({ description: 'Adresse de destination' })
  @IsString()
  destinationAddress: string;

  @ApiProperty({ description: 'Latitude point de départ' })
  @IsNumber()
  pickupLatitude: number;

  @ApiProperty({ description: 'Longitude point de départ' })
  @IsNumber()
  pickupLongitude: number;

  @ApiProperty({ description: 'Latitude destination' })
  @IsNumber()
  destinationLatitude: number;

  @ApiProperty({ description: 'Longitude destination' })
  @IsNumber()
  destinationLongitude: number;

  @ApiProperty({ description: 'Nombre de passagers', minimum: 1, maximum: 8, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  passengerCount?: number;

  @ApiProperty({ description: 'Notes pour le chauffeur', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}