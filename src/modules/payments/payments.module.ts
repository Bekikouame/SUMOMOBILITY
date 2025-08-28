// src/payments/payments.module.ts
import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentWebhooksController } from '../payments/webhoooks/payment-webhooks.controller';
import { PaymentProcessorService } from '../payments/services/payment-processor.service';
import { StripeProcessor } from './processors/stripe-processor';
import { MobileMoneyProcessor } from './processors/mobile-money-processor';
import { PaymentCleanupTask } from '../payments/tasks/payment-cleanup.task';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController, PaymentWebhooksController],
  providers: [
    PaymentsService,
    PaymentProcessorService,
    StripeProcessor,
    MobileMoneyProcessor,
    PaymentCleanupTask,
  ],
  exports: [PaymentsService, PaymentProcessorService],
})
export class PaymentsModule {}
