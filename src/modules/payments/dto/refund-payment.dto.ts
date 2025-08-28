// src/payments/dto/refund-payment.dto.ts
import { IsString, IsOptional, IsDecimal, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class RefundPaymentDto {
  @ApiProperty({ example: '15000.00', description: 'Montant à rembourser (optionnel, par défaut le montant total)' })
  @IsDecimal({ decimal_digits: '0,2' })
  @Transform(({ value }) => parseFloat(value))
  @Min(0)
  @IsOptional()
  amount?: number;

  @ApiProperty({ example: 'Annulation de la course par le client', description: 'Raison du remboursement' })
  @IsString()
  reason: string;
}