export class RatingAnalytics {
  static calculateTrend(ratings: Array<{ score: number; createdAt: Date }>): {
    trend: 'INCREASING' | 'DECREASING' | 'STABLE';
    changeRate: number;
  } {
    if (ratings.length < 2) return { trend: 'STABLE', changeRate: 0 };

    // Diviser en deux périodes
    const midPoint = Math.floor(ratings.length / 2);
    const firstHalf = ratings.slice(0, midPoint);
    const secondHalf = ratings.slice(midPoint);

    const firstAvg = firstHalf.reduce((sum, r) => sum + r.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, r) => sum + r.score, 0) / secondHalf.length;

    const changeRate = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (Math.abs(changeRate) < 5) return { trend: 'STABLE', changeRate };
    
    return {
      trend: changeRate > 0 ? 'INCREASING' : 'DECREASING',
      changeRate: Math.round(Math.abs(changeRate) * 10) / 10,
    };
  }

  static identifyPatterns(ratings: Array<{ score: number; comment?: string }>): {
    hasPattern: boolean;
    type?: 'ALWAYS_HIGH' | 'ALWAYS_LOW' | 'ALTERNATING' | 'SUSPICIOUS_COMMENTS';
    confidence: number;
  } {
    if (ratings.length < 5) return { hasPattern: false, confidence: 0 };

    const scores = ratings.map(r => r.score);
    
    // Toujours des notes élevées (4-5)
    const highScores = scores.filter(s => s >= 4).length;
    if (highScores / scores.length > 0.9) {
      return { hasPattern: true, type: 'ALWAYS_HIGH', confidence: highScores / scores.length };
    }

    // Toujours des notes faibles (1-2)
    const lowScores = scores.filter(s => s <= 2).length;
    if (lowScores / scores.length > 0.8) {
      return { hasPattern: true, type: 'ALWAYS_LOW', confidence: lowScores / scores.length };
    }

    // Commentaires suspects (trop similaires)
    const comments = ratings.filter(r => r.comment).map(r => r.comment!);
    if (comments.length >= 3) {
      const similarity = this.calculateCommentSimilarity(comments);
      if (similarity > 0.7) {
        return { hasPattern: true, type: 'SUSPICIOUS_COMMENTS', confidence: similarity };
      }
    }

    return { hasPattern: false, confidence: 0 };
  }

  private static calculateCommentSimilarity(comments: string[]): number {
    if (comments.length < 2) return 0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < comments.length; i++) {
      for (let j = i + 1; j < comments.length; j++) {
        const similarity = this.stringSimilarity(comments[i], comments[j]);
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private static stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    return (longer.length - this.editDistance(longer, shorter)) / longer.length;
  }

  private static editDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i - 1] + 1,
            matrix[j][i - 1] + 1,
            matrix[j - 1][i] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}
