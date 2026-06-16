import { describe, expect, it } from 'vitest';
import { ReviewRating } from '@prisma/client';

import { UserWordsService } from './user-words.service';

describe('UserWordsService memory curve', () => {
  it('new word (ease=2.5 interval=1): four ratings produce distinct intervals', () => {
    const service = new UserWordsService({} as never);

    const forgot = (service as any).calculateNext(2.5, 1, ReviewRating.completely_forgot);
    const fuzzy = (service as any).calculateNext(2.5, 1, ReviewRating.fuzzy);
    const recognized = (service as any).calculateNext(2.5, 1, ReviewRating.recognized);
    const mastered = (service as any).calculateNext(2.5, 1, ReviewRating.mastered);

    expect(forgot.intervalDays).toBe(1);
    expect(fuzzy.intervalDays).toBe(2);
    expect(recognized.intervalDays).toBe(4);
    expect(mastered.intervalDays).toBe(7);

    expect(forgot.intervalDays).toBeLessThan(fuzzy.intervalDays);
    expect(fuzzy.intervalDays).toBeLessThan(recognized.intervalDays);
    expect(recognized.intervalDays).toBeLessThan(mastered.intervalDays);
  });

  it('intermediate word (ease=2.5 interval=4): four ratings produce distinct intervals', () => {
    const service = new UserWordsService({} as never);

    const forgot = (service as any).calculateNext(2.5, 4, ReviewRating.completely_forgot);
    const fuzzy = (service as any).calculateNext(2.5, 4, ReviewRating.fuzzy);
    const recognized = (service as any).calculateNext(2.5, 4, ReviewRating.recognized);
    const mastered = (service as any).calculateNext(2.5, 4, ReviewRating.mastered);

    expect(forgot.intervalDays).toBe(1);
    expect(fuzzy.intervalDays).toBe(5);
    expect(recognized.intervalDays).toBe(11);
    expect(mastered.intervalDays).toBe(17);
  });

  it('mature word (ease=2.5 interval=10): four ratings produce distinct intervals', () => {
    const service = new UserWordsService({} as never);

    const forgot = (service as any).calculateNext(2.5, 10, ReviewRating.completely_forgot);
    const fuzzy = (service as any).calculateNext(2.5, 10, ReviewRating.fuzzy);
    const recognized = (service as any).calculateNext(2.5, 10, ReviewRating.recognized);
    const mastered = (service as any).calculateNext(2.5, 10, ReviewRating.mastered);

    expect(forgot.intervalDays).toBe(1);
    expect(fuzzy.intervalDays).toBe(12);
    expect(recognized.intervalDays).toBe(27);
    expect(mastered.intervalDays).toBe(42);
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
    expect(next.intervalDays).toBe(9);
  });

  it('low ease word still produces distinct intervals across ratings', () => {
    const service = new UserWordsService({} as never);

    const forgot = (service as any).calculateNext(1.3, 1, ReviewRating.completely_forgot);
    const fuzzy = (service as any).calculateNext(1.3, 1, ReviewRating.fuzzy);
    const recognized = (service as any).calculateNext(1.3, 1, ReviewRating.recognized);
    const mastered = (service as any).calculateNext(1.3, 1, ReviewRating.mastered);

    expect(forgot.intervalDays).toBe(1);
    expect(fuzzy.intervalDays).toBe(2);
    expect(recognized.intervalDays).toBe(4);
    expect(mastered.intervalDays).toBe(7);
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
