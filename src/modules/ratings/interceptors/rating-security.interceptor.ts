import { Injectable, NestInterceptor, ExecutionContext, CallHandler, BadRequestException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RatingSecurityInterceptor implements NestInterceptor {
  private readonly rateLimits = new Map<string, { count: number; resetTime: number }>();
  
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub;
    
    if (request.method === 'POST' && request.url.includes('/ratings')) {
      this.checkRateLimit(userId);
    }

    return next.handle().pipe(
      tap((data) => {
        // Log des évaluations créées pour audit
        if (data?.id) {
          console.log(`📊 Rating créé: ${data.score}/5 par utilisateur ${userId}`);
        }
      }),
    );
  }

  private checkRateLimit(userId: string) {
    const now = Date.now();
    const limit = this.rateLimits.get(userId);
    
    if (!limit || now > limit.resetTime) {
      this.rateLimits.set(userId, { count: 1, resetTime: now + 60000 }); // 1 minute
      return;
    }
    
    if (limit.count >= 5) { // Max 5 évaluations par minute
      throw new BadRequestException('Trop d\'évaluations créées récemment. Veuillez patienter.');
    }
    
    limit.count++;
  }
}