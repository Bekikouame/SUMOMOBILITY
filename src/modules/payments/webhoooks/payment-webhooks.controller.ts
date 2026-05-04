// src/payments/webhooks/payment-webhooks.controller.ts
import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { PaymentProcessorService } from '../services/payment-processor.service';
import { PaymentsService } from '../payments.service';
import { PaymentMethod } from '@prisma/client';
import * as crypto from 'crypto';

@Controller('webhooks/payments')
export class PaymentWebhooksController {
  constructor(
    private paymentProcessorService: PaymentProcessorService,
    private paymentsService: PaymentsService,
  ) {}

  @Post('stripe')
  async handleStripeWebhook(
    @Body() payload: any,
    @Headers('stripe-signature') signature: string,
  ) {
    // Vérifier la signature via le processor Stripe
    const processor = this.getProcessor(PaymentMethod.CREDIT_CARD);
    if (!processor.verifyWebhook(payload, signature)) {
      throw new BadRequestException('Invalid signature');
    }

    // Traiter l'événement
    switch (payload.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(payload.data.object);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(payload.data.object);
        break;
    }

    return { received: true };
  }

  @Post('mobile-money')
  async handleMobileMoneyWebhook(
    @Body() payload: any,
    @Headers('x-webhook-signature') signature: string,
  ) {
    const secret = process.env.MOBILE_MONEY_WEBHOOK_SECRET;
    if (secret) {
      if (!signature) throw new BadRequestException('Signature manquante');
      const expected = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        throw new BadRequestException('Signature invalide');
      }
    }

    const { transactionId, status, amount } = payload;

    const payment = await this.paymentsService.findByTransactionId(transactionId);
    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    if (status === 'SUCCESS') {
      await this.paymentsService.markAsSucceeded(payment.id);
    } else {
      await this.paymentsService.markAsFailed(payment.id, payload.errorMessage);
    }

    return { received: true };
  }

  private async handlePaymentSuccess(paymentIntent: any) {
    const payment = await this.paymentsService.findByTransactionId(paymentIntent.id);
    if (payment) {
      await this.paymentsService.markAsSucceeded(payment.id);
    }
  }

  private async handlePaymentFailure(paymentIntent: any) {
    const payment = await this.paymentsService.findByTransactionId(paymentIntent.id);
    if (payment) {
      await this.paymentsService.markAsFailed(payment.id, paymentIntent.last_payment_error?.message);
    }
  }

  // ✅ Méthode helper pour obtenir le bon processor
  private getProcessor(method: PaymentMethod) {
    switch (method) {
      case PaymentMethod.CREDIT_CARD:
        return (this.paymentProcessorService as any).stripeProcessor;
      case PaymentMethod.MOBILE_MONEY:
        return (this.paymentProcessorService as any).mobileMoneyProcessor;
      default:
        throw new Error(`Méthode de paiement non supportée: ${method}`);
    }
  }
} // ✅ Accolade fermante ajoutée