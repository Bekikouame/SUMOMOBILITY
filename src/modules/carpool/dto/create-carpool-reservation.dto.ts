import { IsString, IsNumber, IsBoolean, IsOptional, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCarpoolReservationDto {
  @ApiProperty({ example: 'Cocody Riviera Golf' })
  @IsString()
  pickupAddress: string;

  @ApiProperty({ example: 'Plateau Centre' })
  @IsString()
  destinationAddress: string;

  @ApiProperty({ example: 5.3364 })
  @IsNumber()
  pickupLatitude: number;

  @ApiProperty({ example: -3.9739 })
  @IsNumber()
  pickupLongitude: number;

  @ApiProperty({ example: 5.3242 })
  @IsNumber()
  destinationLatitude: number;

  @ApiProperty({ example: -4.0093 })
  @IsNumber()
  destinationLongitude: number;

  @ApiProperty({ example: '2025-01-20T15:00:00Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isSharedRide?: boolean = false;

  @ApiProperty({ example: 2, minimum: 0, maximum: 6 })
  @IsOptional()
  @Min(0)
  @Max(6)
  maxSharedPassengers?: number = 0;

  @ApiProperty({ example: 15, minimum: 5, maximum: 30 })
  @IsOptional()
  @Min(5)
  @Max(30)
  maxDetourMinutes?: number = 15;

  @ApiProperty({ example: 'FLEXIBLE_ROUTE', enum: ['SAME_DESTINATION', 'FLEXIBLE_ROUTE'] })
  @IsOptional()
  @IsString()
  sharePreference?: string;

  @ApiProperty({ example: 'Besoin d\'être à l\'heure SVP' })
  @IsOptional()
  @IsString()
  notes?: string;
}