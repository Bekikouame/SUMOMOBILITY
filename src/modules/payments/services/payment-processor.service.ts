// src/payments/services/payment-processor.service.ts
import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { StripeProcessor } from '../processors/stripe-processor';
import { MobileMoneyProcessor } from '../processors/mobile-money-processor';
import { BasePaymentProcessor } from '../processors/base-payment-processor';
import { PaymentProcessorResponse } from '../processors/base-payment-processor';

@Injectable()
export class PaymentProcessorService {
  constructor(
    private stripeProcessor: StripeProcessor,
    private mobileMoneyProcessor: MobileMoneyProcessor,
  ) {}

  async processPayment(
    amount: number,
    method: PaymentMethod,
    metadata?: any
  ): Promise<PaymentProcessorResponse> {
    const processor = this.getProcessor(method);
    return processor.processPayment(amount, method, metadata);
  }

  async refundPayment(
    transactionId: string,
    method: PaymentMethod,
    amount?: number,
    reason?: string
  ): Promise<PaymentProcessorResponse> {
    const processor = this.getProcessor(method);
    return processor.refundPayment(transactionId, amount, reason);
  }

  private getProcessor(method: PaymentMethod): BasePaymentProcessor {
    switch (method) {
      case PaymentMethod.CREDIT_CARD:
        return this.stripeProcessor;
      case PaymentMethod.MOBILE_MONEY:
        return this.mobileMoneyProcessor;
      case PaymentMethod.CASH:
        // Pour les paiements en espèces, pas de traitement en ligne
        throw new Error('Les paiements en espèces ne nécessitent pas de traitement en ligne');
      case PaymentMethod.WALLET:
        // Wallet interne à la plateforme
        return this.createWalletProcessor();
      default:
        throw new Error(`Méthode de paiement non supportée: ${method}`);
    }
  }

  private createWalletProcessor(): BasePaymentProcessor {
    return {
      async processPayment(amount: number, method: PaymentMethod, metadata?: any): Promise<PaymentProcessorResponse> {
        // Logique portefeuille interne
        return {
          success: true,
          transactionId: `wallet_${Date.now()}`,
          amount: amount,
          currency: 'XOF',
          processorFee: 0,
        };
      },
      async refundPayment(transactionId: string, amount?: number, reason?: string): Promise<PaymentProcessorResponse> {
        return {
          success: true,
          transactionId: `wallet_refund_${Date.now()}`,
          amount: amount || 0,
          currency: 'XOF',
          processorFee: 0,
        };
      },
      verifyWebhook(): boolean {
        return true;
      }
    };
  }
}