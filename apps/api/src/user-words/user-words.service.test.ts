import { describe, expect, it } from 'vitest';

import { UserWordsService } from './user-words.service';

describe('UserWordsService memory curve', () => {
  it('known should increase ease and interval', () => {
    const service = new UserWordsService({} as never);
    const next = (service as any).calculateNext(2.5, 2, true);
    expect(next.easeFactor).toBe(2.65);
    expect(next.intervalDays).toBe(5);
  });

  it('unknown should reset interval to 1', () => {
    const service = new UserWordsService({} as never);
    const next = (service as any).calculateNext(1.4, 4, false);
    expect(next.easeFactor).toBe(1.3);
    expect(next.intervalDays).toBe(1);
  });
});
