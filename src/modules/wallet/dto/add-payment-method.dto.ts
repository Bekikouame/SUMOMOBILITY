// src/modules/wallet/dto/add-payment-method.dto.ts
import { IsString, IsEnum, IsOptional, IsBoolean, ValidateIf } from 'class-validator';
import { PaymentMethodType } from '@prisma/client';

export class AddPaymentMethodDto {
  @IsEnum(PaymentMethodType)
  type: PaymentMethodType;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  // Carte bancaire
  @ValidateIf((o) => o.type === PaymentMethodType.CARD)
  @IsString()
  cardNumber?: string;

  @ValidateIf((o) => o.type === PaymentMethodType.CARD)
  @IsString()
  cardHolderName?: string;

  @ValidateIf((o) => o.type === PaymentMethodType.CARD)
  @IsString()
  expiryMonth?: string;

  @ValidateIf((o) => o.type === PaymentMethodType.CARD)
  @IsString()
  expiryYear?: string;

  @ValidateIf((o) => o.type === PaymentMethodType.CARD)
  @IsString()
  cvv?: string;

  // Mobile Money (Wave, Orange Money)
  @ValidateIf((o) => o.type === PaymentMethodType.WAVE || o.type === PaymentMethodType.ORANGE_MONEY)
  @IsString()
  phoneNumber?: string;

  // Compte bancaire
  @ValidateIf((o) => o.type === PaymentMethodType.BANK_ACCOUNT)
  @IsString()
  bankName?: string;

  @ValidateIf((o) => o.type === PaymentMethodType.BANK_ACCOUNT)
  @IsString()
  accountNumber?: string;

  @ValidateIf((o) => o.type === PaymentMethodType.BANK_ACCOUNT)
  @IsString()
  accountHolderName?: string;
}
