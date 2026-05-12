import { IsString, IsEnum, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class SendOtpDto {
  @ApiProperty({ example: '+2250123456789', description: 'Numéro au format international' })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'Numéro de téléphone invalide (format: +2250123456789)' })
  phone: string;

  @ApiProperty({ enum: UserRole, default: UserRole.CLIENT, required: false })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.CLIENT;
}
