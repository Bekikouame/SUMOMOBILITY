import { IsNumber, IsDateString, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchCarpoolDto {
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

  @ApiProperty({ example: 5.0, default: 5.0 })
  @IsOptional()
  @Min(0.5)
  @Max(50)
  radiusKm?: number = 5.0;

  @ApiProperty({ example: 20, default: 20 })
  @IsOptional()
  @Min(5)
  @Max(60)
  maxDetourMinutes?: number = 20;
}