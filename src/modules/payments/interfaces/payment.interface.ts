// src/payments/interfaces/payment.interface.ts
export interface PaymentGatewayConfig {
  stripe?: {
    publicKey: string;
    secretKey: string;
    webhookSecret: string;
  };
  mobileMoney?: {
    apiUrl: string;
    apiKey: string;
    merchantId: string;
  };
}

export interface PaymentProcessorResponse {
  success: boolean;
  transactionId: string;
  processorFee?: number;
  failureReason?: string;
  gatewayData?: any;
}

export interface EarningsReport {
  driverId: string;
  driverName: string;
  period: {
    startDate: string | null;
    endDate: string | null;
    ridesCount: number;
  };
  earnings: {
    totalEarnings: number;
    totalPayments: number;
    platformFee: number;
    averagePerRide: number;
  };
  rides: Array<{
    id: string;
    completedAt: Date;
    totalFare: number;
    driverEarnings: number;
    platformFee: number;
  }>;
}
