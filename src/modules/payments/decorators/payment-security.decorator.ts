// src/payments/decorators/payment-security.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PAYMENT_SECURITY_KEY = 'paymentSecurity';
export const PaymentSecurity = (level: 'READ' | 'WRITE' | 'ADMIN') => 
  SetMetadata(PAYMENT_SECURITY_KEY, level);

// Usage:
// @PaymentSecurity('ADMIN')
// async refundPayment() { ... }
