// dto/estimate-fare.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsInt, Min, Max, IsEnum } from 'class-validator';
export class EstimateFareDto {
  @ApiProperty()
  @IsNumber()
  pickupLatitude: number;

  @ApiProperty()
  @IsNumber()
  pickupLongitude: number;

  @ApiProperty()
  @IsNumber()
  destinationLatitude: number;

  @ApiProperty()
  @IsNumber()
  destinationLongitude: number;

  @IsOptional()
  @IsString()
  rideType?: string;

  @IsOptional()
  @IsNumber()
  passengerCount?: number;
}