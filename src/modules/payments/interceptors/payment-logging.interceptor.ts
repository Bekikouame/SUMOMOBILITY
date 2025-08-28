// src/payments/interceptors/payment-logging.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class PaymentLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        
        // Log sécurisé (sans données sensibles)
        const logData = {
          method,
          url,
          userId: user?.sub,
          userRole: user?.role,
          duration: `${duration}ms`,
          paymentId: data?.id,
          amount: body?.amount,
          paymentMethod: body?.method,
          status: data?.status,
          timestamp: new Date().toISOString(),
        };

        console.log('💳 Payment Operation:', JSON.stringify(logData, null, 2));
      }),
    );
  }
}