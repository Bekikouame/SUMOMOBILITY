// / src/payments/tests/payment-calculator.spec.ts
import { PaymentCalculator } from '../../payments/utils/payment-calculator';

describe('PaymentCalculator', () => {
  describe('calculateRideFare', () => {
    it('should calculate standard ride fare correctly', () => {
      const result = PaymentCalculator.calculateRideFare(5, 15, 'STANDARD');

      expect(result.baseFare).toBe(500);
      expect(result.distanceFare).toBe(1000); // 5km * 200 FCFA
      expect(result.timeFare).toBe(750);     // 15min * 50 FCFA
      expect(result.totalFare).toBe(2250);   // 500 + 1000 + 750
      expect(result.platformFee).toBe(338);  // 15% de 2250
      expect(result.driverEarnings).toBe(1912); // 2250 - 338
    });

    it('should apply minimum fare when calculated fare is too low', () => {
      const result = PaymentCalculator.calculateRideFare(0.5, 2, 'STANDARD');

      expect(result.totalFare).toBe(1000); // Minimum fare
      expect(result.platformFee).toBe(150); // 15% de 1000
      expect(result.driverEarnings).toBe(850);
    });

    it('should calculate premium ride fare correctly', () => {
      const result = PaymentCalculator.calculateRideFare(3, 10, 'PREMIUM');

      expect(result.baseFare).toBe(800);
      expect(result.distanceFare).toBe(1050); // 3km * 350 FCFA
      expect(result.timeFare).toBe(800);      // 10min * 80 FCFA
      expect(result.totalFare).toBe(2650);
    });
  });

  describe('calculateCancellationFee', () => {
    it('should return 0 for driver cancellation', () => {
      const fee = PaymentCalculator.calculateCancellationFee('DRIVER', 'ACCEPTED', 600);
      expect(fee).toBe(0);
    });

    it('should return 0 for early client cancellation', () => {
      const fee = PaymentCalculator.calculateCancellationFee('CLIENT', 'ACCEPTED', 200);
      expect(fee).toBe(0);
    });

    it('should return 500 for medium delay client cancellation', () => {
      const fee = PaymentCalculator.calculateCancellationFee('CLIENT', 'ACCEPTED', 600);
      expect(fee).toBe(500);
    });

    it('should return 1000 for late client cancellation', () => {
      const fee = PaymentCalculator.calculateCancellationFee('CLIENT', 'ACCEPTED', 1000);
      expect(fee).toBe(1000);
    });

    it('should return 2000 for cancellation during ride', () => {
      const fee = PaymentCalculator.calculateCancellationFee('CLIENT', 'IN_PROGRESS');
      expect(fee).toBe(2000);
    });
  });
});