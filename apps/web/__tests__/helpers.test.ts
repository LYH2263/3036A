import { describe, expect, it } from 'vitest';

import { emailValid, formatPercent } from '../lib/helpers';

describe('helpers', () => {
  it('formats percent', () => {
    expect(formatPercent(12.345)).toBe('12.3%');
  });

  it('validates email', () => {
    expect(emailValid('demo@example.com')).toBe(true);
    expect(emailValid('not-email')).toBe(false);
  });
});
