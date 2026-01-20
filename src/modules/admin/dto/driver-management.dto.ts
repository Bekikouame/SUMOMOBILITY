// src/modules/admin/dto/driver-management.dto.ts

import { IsString, IsOptional, IsNotEmpty, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApproveDriverDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  message?: string;
}

export class RejectDriverDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class DeleteDriverDto {
  @ApiProperty({ 
    description: 'Confirmation de suppression',
    example: true 
  })
  @IsBoolean()
  @IsNotEmpty()
  confirmDelete: boolean;

  @ApiProperty({ 
    required: false,
    description: 'Raison de la suppression (optionnel)' 
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
