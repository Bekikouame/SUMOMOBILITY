// src/modules/rides/dto/update-ride.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { RideStatus } from '@prisma/client';

export class UpdateRideDto {
  @ApiProperty({ enum: RideStatus, required: false })
  @IsOptional()
  @IsEnum(RideStatus)
  status?: RideStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
