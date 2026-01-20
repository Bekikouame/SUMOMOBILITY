// src/modules/wallet/dto/get-transactions.dto.ts
import { IsOptional, IsNumber, Min, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { WalletTransactionType, WalletTransactionStatus } from '@prisma/client';

export class GetTransactionsDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(WalletTransactionType)
  type?: WalletTransactionType;

  @IsOptional()
  @IsEnum(WalletTransactionStatus)
  status?: WalletTransactionStatus;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
