// src/payments/dto/create-payment.dto.ts
import { IsEnum, IsDecimal, IsString, IsOptional, IsUUID, Min, IsNumber } from 'class-validator';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreatePaymentDto {
  // @ApiProperty({ example: '25000.50', description: 'Montant du paiement' })
  // @IsDecimal({ decimal_digits: '0,2' })
  // @Transform(({ value }) => parseFloat(value))
  // @Min(0)
  // amount: number;
   @ApiProperty({ example: 25000.5, description: 'Montant du paiement' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount doit être un nombre avec max 2 décimales' })
  @Min(0)
  amount: number;

  @ApiProperty({ example: 'XOF', description: 'Devise', default: 'XOF' })
  @IsString()
  @IsOptional()
  currency?: string = 'XOF';

  @ApiProperty({ enum: PaymentMethod, description: 'Méthode de paiement' })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ example: 'course-123', description: 'ID de la course (optionnel)', required: false })
  @IsString()
  @IsOptional()
  rideId?: string;

  @ApiProperty({ example: 'reservation-456', description: 'ID de la réservation (optionnel)', required: false })
  @IsString()
  @IsOptional()
  reservationId?: string;

  @ApiProperty({ example: 'FARE', description: 'Type de paiement', enum: ['FARE', 'TIP', 'DEPOSIT', 'CANCELLATION_FEE'] })
  @IsString()
  @IsOptional()
  paymentType?: string = 'FARE';

  @ApiProperty({ example: 'ext-transaction-789', description: 'ID transaction externe (optionnel)', required: false })
  @IsString()
  @IsOptional()
  transactionId?: string;
}