// src/modules/rides/dto/query-rides.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString, IsString } from 'class-validator';
import { RideStatus } from '@prisma/client';

export class QueryRidesDto {
  @ApiProperty({ enum: RideStatus, required: false })
  @IsOptional()
  @IsEnum(RideStatus)
  status?: RideStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsString()
  offset?: string;
}
