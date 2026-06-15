import { describe, expect, it } from 'vitest';
import { ReviewRating } from '@prisma/client';

import { UserWordsService } from './user-words.service';

describe('UserWordsService memory curve', () => {
  it('mastered should greatly increase ease and interval', () => {
    const service = new UserWordsService({} as never);
    const next = (service as any).calculateNext(2.5, 2, ReviewRating.mastered);
    expect(next.easeFactor).toBe(2.8);
    expect(next.intervalDays).toBe(7);
  });

  it('recognized should moderately increase ease and interval', () => {
    const service = new UserWordsService({} as never);
    const next = (service as any).calculateNext(2.5, 2, ReviewRating.recognized);
    expect(next.easeFactor).toBe(2.65);
    expect(next.intervalDays).toBe(5);
  });

  it('fuzzy should decrease ease and reduce interval', () => {
    const service = new UserWordsService({} as never);
    const next = (service as any).calculateNext(2.5, 4, ReviewRating.fuzzy);
    expect(next.easeFactor).toBe(2.35);
    expect(next.intervalDays).toBe(5);
  });

  it('completely_forgot should decrease ease and reset interval to 1', () => {
    const service = new UserWordsService({} as never);
    const next = (service as any).calculateNext(2.5, 4, ReviewRating.completely_forgot);
    expect(next.easeFactor).toBe(2.2);
    expect(next.intervalDays).toBe(1);
  });

  it('ease factor should not go below minimum', () => {
    const service = new UserWordsService({} as never);
    const next = (service as any).calculateNext(1.4, 4, ReviewRating.completely_forgot);
    expect(next.easeFactor).toBe(1.3);
    expect(next.intervalDays).toBe(1);
  });

  it('ease factor should not go above maximum', () => {
    const service = new UserWordsService({} as never);
    const next = (service as any).calculateNext(2.9, 2, ReviewRating.mastered);
    expect(next.easeFactor).toBe(3.0);
    expect(next.intervalDays).toBe(7);
  });

  it('normalizeRating with rating should derive known correctly', () => {
    const service = new UserWordsService({} as never);
    const result1 = (service as any).normalizeRating({ rating: ReviewRating.mastered });
    expect(result1.rating).toBe(ReviewRating.mastered);
    expect(result1.known).toBe(true);

    const result2 = (service as any).normalizeRating({ rating: ReviewRating.completely_forgot });
    expect(result2.rating).toBe(ReviewRating.completely_forgot);
    expect(result2.known).toBe(false);
  });

  it('normalizeRating with only known should map to default ratings', () => {
    const service = new UserWordsService({} as never);
    const result1 = (service as any).normalizeRating({ known: true });
    expect(result1.rating).toBe(ReviewRating.recognized);
    expect(result1.known).toBe(true);

    const result2 = (service as any).normalizeRating({ known: false });
    expect(result2.rating).toBe(ReviewRating.fuzzy);
    expect(result2.known).toBe(false);
  });
});
