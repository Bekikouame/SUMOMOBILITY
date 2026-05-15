import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { BasePaymentProcessor, PaymentProcessorResponse } from './base-payment-processor';
import { defaultPaymentConfig } from '../config/payment.config';

@Injectable()
export class MobileMoneyProcessor extends BasePaymentProcessor {
  private readonly logger = new Logger(MobileMoneyProcessor.name);
  private readonly config = defaultPaymentConfig.mobileMoney;

  async processPayment(
    amount: number,
    method: string,
    metadata?: any,
  ): Promise<PaymentProcessorResponse> {
    try {
      if (method === 'WAVE') {
        return await this.processWavePayment(amount, metadata);
      }
      if (method === 'ORANGE_MONEY') {
        return await this.processOrangeMoneyPayment(amount, metadata);
      }
      return this.unsupportedProvider(method, amount);
    } catch (error) {
      this.logger.error(`Erreur paiement ${method}: ${error.message}`);
      return {
        success: false,
        transactionId: `mm_${Date.now()}_failed`,
        status: 'failed',
        amount,
        currency: 'XOF',
        failureReason: error.message,
        processedAt: new Date(),
      };
    }
  }

  // ─── Wave ────────────────────────────────────────────────────────────────

  private async processWavePayment(
    amount: number,
    metadata?: any,
  ): Promise<PaymentProcessorResponse> {
    const { apiUrl, secretKey } = this.config.wave;
    const clientReference = `sumo_${Date.now()}`;

    const response = await fetch(`${apiUrl}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(amount),
        currency: 'XOF',
        client_reference: clientReference,
        success_url: metadata?.successUrl || `${process.env.APP_URL}/payment/success`,
        error_url: metadata?.errorUrl || `${process.env.APP_URL}/payment/error`,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Wave API error ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      transactionId: data.id,
      status: 'pending',
      amount,
      currency: 'XOF',
      processedAt: new Date(),
      metadata: {
        waveUrl: data.wave_launch_url,
        clientReference: data.client_reference,
        checkoutStatus: data.checkout_status,
      },
    };
  }

  // ─── Orange Money ─────────────────────────────────────────────────────────

  private async processOrangeMoneyPayment(
    amount: number,
    metadata?: any,
  ): Promise<PaymentProcessorResponse> {
    const { apiUrl, merchantId, apiKey, country } = this.config.orangeMoney;

    // Étape 1 : obtenir le token OAuth Orange
    const tokenResponse = await fetch('https://api.orange.com/oauth/v3/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${merchantId}:${apiKey}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      throw new Error(`Orange Money auth error ${tokenResponse.status}`);
    }

    const { access_token } = await tokenResponse.json();
    const orderId = `sumo_${Date.now()}`;

    // Étape 2 : initier le paiement
    const paymentResponse = await fetch(
      `${apiUrl}/${country}/v1/webpayment`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchant_key: merchantId,
          currency: 'OUV',
          order_id: orderId,
          amount,
          return_url: metadata?.successUrl || `${process.env.APP_URL}/payment/success`,
          cancel_url: metadata?.errorUrl || `${process.env.APP_URL}/payment/error`,
          notif_url: `${process.env.APP_URL}/webhooks/payments/mobile-money`,
          lang: 'fr',
          reference: orderId,
        }),
      },
    );

    if (!paymentResponse.ok) {
      const err = await paymentResponse.json().catch(() => ({}));
      throw new Error(err.message || `Orange Money API error ${paymentResponse.status}`);
    }

    const data = await paymentResponse.json();

    return {
      success: true,
      transactionId: data.pay_token || orderId,
      status: 'pending',
      amount,
      currency: 'XOF',
      processedAt: new Date(),
      metadata: {
        paymentUrl: data.payment_url,
        payToken: data.pay_token,
        orderId,
        notifToken: data.notif_token,
      },
    };
  }

  // ─── Remboursement ────────────────────────────────────────────────────────

  async refundPayment(
    transactionId: string,
    amount?: number,
    reason?: string,
  ): Promise<PaymentProcessorResponse> {
    if (!amount || amount <= 0) {
      return {
        success: false,
        transactionId: `refund_${transactionId}_failed`,
        status: 'failed',
        amount: amount || 0,
        currency: 'XOF',
        failureReason: 'Montant de remboursement invalide',
        processedAt: new Date(),
      };
    }

    // Wave ne supporte pas les remboursements programmatiques via API pour l'instant —
    // ils se font depuis le dashboard Wave ou via leur support.
    this.logger.warn(
      `Remboursement ${transactionId} à traiter manuellement via le dashboard Wave/Orange.`,
    );

    return {
      success: true,
      transactionId: `refund_${transactionId}_${Date.now()}`,
      status: 'refunded',
      amount,
      currency: 'XOF',
      processedAt: new Date(),
      metadata: { originalTransactionId: transactionId, reason, manualRefund: true },
    };
  }

  // ─── Vérification webhook ─────────────────────────────────────────────────

  verifyWebhook(payload: any, signature: string): boolean {
    try {
      const secret = this.config.wave.webhookSecret || process.env.MOBILE_MONEY_WEBHOOK_SECRET;
      if (!secret) return false;

      const expected = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex'),
      );
    } catch (error) {
      this.logger.error('Erreur vérification webhook:', error.message);
      return false;
    }
  }

  private unsupportedProvider(method: string, amount: number): PaymentProcessorResponse {
    return {
      success: false,
      transactionId: `mm_${Date.now()}_failed`,
      status: 'failed',
      amount,
      currency: 'XOF',
      failureReason: `Fournisseur Mobile Money non supporté: ${method}`,
      processedAt: new Date(),
    };
  }
}
