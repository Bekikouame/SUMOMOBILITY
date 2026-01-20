// src/modules/wallet/dto/request-withdrawal.dto.ts
import { IsNumber, IsString, Min, IsOptional } from 'class-validator';

export class RequestWithdrawalDto {
  @IsNumber()
  @Min(1000, { message: 'Le montant minimum pour un retrait est de 1000 FCFA' })
  amount: number;

  @IsString()
  paymentMethodId: string;

  @IsString()
  @IsOptional()
  note?: string;
}
