import { describe, it, expect } from 'vitest';
import { pctRda } from '@/lib/rda';

describe('pctRda', () => {
  it('returns null when rda is null', () => {
    expect(pctRda(50, null)).toBeNull();
  });
  it('returns null when rda is 0', () => {
    expect(pctRda(50, 0)).toBeNull();
  });
  it('returns the correct percentage rounded to nearest integer', () => {
    expect(pctRda(45, 90)).toBe(50);
    expect(pctRda(135, 90)).toBe(150);
  });
  it('handles numeric strings from numeric columns', () => {
    expect(pctRda('45', '90')).toBe(50);
  });
});
