import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Montant du paiement' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  currency?: string = 'XOF';

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  transactionId?: string;
}