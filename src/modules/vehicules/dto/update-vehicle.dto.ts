// src/vehicles/dto/update-vehicle.dto.ts
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateVehicleDto } from './create-vehicle.dto';

export class UpdateVehicleDto extends PartialType(
  OmitType(CreateVehicleDto, ['plateNumber'] as const)
) {}