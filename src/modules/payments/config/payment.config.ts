export interface PaymentConfig {
  stripe: {
    publicKey: string;
    secretKey: string;
    webhookSecret: string;
    currency: string;
  };
  mobileMoney: {
    orangeMoney: {
      apiUrl: string;
      merchantId: string;
      apiKey: string;
    };
    mtnMoney: {
      apiUrl: string;
      subscriptionKey: string;
      apiKey: string;
    };
    moovMoney: {
      apiUrl: string;
      merchantCode: string;
      apiKey: string;
    };
  };
  platform: {
    commissionRate: number; // 0.15 = 15%
    minimumPayout: number;  // Minimum pour retirer les gains
    currency: string;       // XOF
  };
  fees: {
    cancellationBaseFee: number;     // 500 FCFA
    cancellationLateFee: number;     // 1000 FCFA
    processingFeeRate: number;       // 0.02 = 2%
  };
}

export const defaultPaymentConfig: PaymentConfig = {
  stripe: {
    publicKey: process.env.STRIPE_PUBLIC_KEY || '',
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    currency: 'xof',
  },
  mobileMoney: {
    orangeMoney: {
      apiUrl: process.env.ORANGE_MONEY_API_URL || 'https://api.orange.com/orange-money-webpay',
      merchantId: process.env.ORANGE_MONEY_MERCHANT_ID || '',
      apiKey: process.env.ORANGE_MONEY_API_KEY || '',
    },
    mtnMoney: {
      apiUrl: process.env.MTN_MONEY_API_URL || 'https://sandbox.momodeveloper.mtn.com',
      subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY || '',
      apiKey: process.env.MTN_API_KEY || '',
    },
    moovMoney: {
      apiUrl: process.env.MOOV_MONEY_API_URL || '',
      merchantCode: process.env.MOOV_MONEY_MERCHANT_CODE || '',
      apiKey: process.env.MOOV_MONEY_API_KEY || '',
    },
  },
  platform: {
    commissionRate: parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.15'),
    minimumPayout: parseFloat(process.env.MINIMUM_PAYOUT || '5000'), // 5000 FCFA
    currency: 'XOF',
  },
  fees: {
    cancellationBaseFee: 500,
    cancellationLateFee: 1000,
    processingFeeRate: 0.02,
  },
};
