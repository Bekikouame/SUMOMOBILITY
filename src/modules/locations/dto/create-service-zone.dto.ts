import { IsString, IsOptional, IsBoolean, IsNumber, IsObject, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateServiceZoneDto {
  @ApiProperty({ example: 'Abidjan Centre' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'CI' })
  @IsString()
  country: string;

  @ApiProperty({ example: 'Abidjan' })
  @IsString()
  city: string;

  @ApiProperty({ description: 'GeoJSON Polygon coordinates' })
  @IsObject()
  geometry: any;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @Min(0)
  baseFare: number;

  @ApiProperty({ example: 300 })
  @IsNumber()
  @Min(0)
  perKmRate: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(0)
  perMinuteRate: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  maxRadius?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  operatingHours?: any;
}