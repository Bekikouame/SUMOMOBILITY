import { RatingAnalytics } from '../utils/rating-analytics.util';

describe('RatingAnalytics', () => {
  describe('calculateTrend', () => {
    it('should identify increasing trend', () => {
      const ratings = [
        { score: 3, createdAt: new Date('2024-01-01') },
        { score: 4, createdAt: new Date('2024-01-02') },
        { score: 4, createdAt: new Date('2024-01-03') },
        { score: 5, createdAt: new Date('2024-01-04') },
      ];

      const result = RatingAnalytics.calculateTrend(ratings);
      expect(result.trend).toBe('INCREASING');
      expect(result.changeRate).toBeGreaterThan(0);
    });

    it('should identify stable trend', () => {
      const ratings = [
        { score: 4, createdAt: new Date('2024-01-01') },
        { score: 4, createdAt: new Date('2024-01-02') },
        { score: 4, createdAt: new Date('2024-01-03') },
        { score: 4, createdAt: new Date('2024-01-04') },
      ];

      const result = RatingAnalytics.calculateTrend(ratings);
      expect(result.trend).toBe('STABLE');
      expect(result.changeRate).toBe(0);
    });
  });

  describe('identifyPatterns', () => {
    it('should detect always high pattern', () => {
      const ratings = [
        { score: 5, comment: 'Great' },
        { score: 5, comment: 'Excellent' },
        { score: 4, comment: 'Good' },
        { score: 5, comment: 'Perfect' },
        { score: 5, comment: 'Amazing' },
      ];

      const result = RatingAnalytics.identifyPatterns(ratings);
      expect(result.hasPattern).toBe(true);
      expect(result.type).toBe('ALWAYS_HIGH');
    });

    it('should detect suspicious comments', () => {
      const ratings = [
        { score: 5, comment: 'Great service' },
        { score: 5, comment: 'Great service' },
        { score: 5, comment: 'Great service' },
        { score: 5, comment: 'Great service' },
        { score: 5, comment: 'Great service' },
      ];

      const result = RatingAnalytics.identifyPatterns(ratings);
      expect(result.hasPattern).toBe(true);
      expect(result.type).toBe('SUSPICIOUS_COMMENTS');
    });
  });
});
