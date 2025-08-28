// src/payments/processors/base-payment-processor.ts

// Interface pour la réponse du processeur de paiement
export interface PaymentProcessorResponse {
  success: boolean;
  transactionId: string;
  status?: 'pending' | 'succeeded' | 'failed' | 'refunded';
  amount: number; // Obligatoire - montant traité
  currency: string; // Obligatoire - devise
  processorFee?: number;
  netAmount?: number;
  errorCode?: string;
  errorMessage?: string;
  failureReason?: string; // Ajouté pour correspondre au code mobile-money
  metadata?: Record<string, any>;
  processedAt?: Date;
}

// Classe abstraite pour les processeurs de paiement
export abstract class BasePaymentProcessor {
  abstract processPayment(
    amount: number,
    method: string,
    metadata?: any
  ): Promise<PaymentProcessorResponse>;
  
  abstract refundPayment(
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<PaymentProcessorResponse>;
  
  abstract verifyWebhook(payload: any, signature: string): boolean;
}