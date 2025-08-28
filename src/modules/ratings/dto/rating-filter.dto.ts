import { IsOptional, IsUUID, IsInt, Min, Max, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../payments/dto/pagination.dto';

export class RatingFilterDto extends PaginationDto {
  @ApiProperty({ example: 'driver-123', description: 'ID du chauffeur', required: false })
  @IsUUID()
  @IsOptional()
  driverId?: string;

  @ApiProperty({ example: 'client-456', description: 'ID du client', required: false })
  @IsUUID()
  @IsOptional()
  clientId?: string;

  @ApiProperty({ example: 4, description: 'Note minimum', required: false })
  @IsInt()
  @Min(1)
  @Max(5)
  @Transform(({ value }) => parseInt(value))
  @IsOptional()
  minScore?: number;

  @ApiProperty({ example: 5, description: 'Note maximum', required: false })
  @IsInt()
  @Min(1)
  @Max(5)
  @Transform(({ value }) => parseInt(value))
  @IsOptional()
  maxScore?: number;

  @ApiProperty({ example: '2024-01-01', description: 'Date de début', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: '2024-12-31', description: 'Date de fin', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
