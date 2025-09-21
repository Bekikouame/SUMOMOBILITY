import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinCarpoolDto {
  @ApiProperty({ example: 'clx123...' })
  @IsString()
  reservationId: string;

  @ApiProperty({ example: 'Cocody Angré' })
  @IsString()
  pickupAddress: string;

  @ApiProperty({ example: 'Plateau Cathédrale' })
  @IsString()
  destinationAddress: string;

  @ApiProperty({ example: 5.3400 })
  @IsNumber()
  pickupLatitude: number;

  @ApiProperty({ example: -3.9700 })
  @IsNumber()
  pickupLongitude: number;

  @ApiProperty({ example: 5.3200 })
  @IsNumber()
  destinationLatitude: number;

  @ApiProperty({ example: -4.0100 })
  @IsNumber()
  destinationLongitude: number;

  @ApiProperty({ example: 'Salut, peux-tu me prendre à Angré ? Merci !', required: false })
  @IsOptional()
  @IsString()
  message?: string;
}