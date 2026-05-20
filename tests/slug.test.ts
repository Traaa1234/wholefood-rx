import { describe, it, expect } from 'vitest';
import { toSlug } from '@/lib/slug';

describe('toSlug', () => {
  it('lowercases', () => {
    expect(toSlug('Vitamin C')).toBe('vitamin-c');
  });
  it('replaces spaces and punctuation with hyphens', () => {
    expect(toSlug('Omega-3 (ALA)')).toBe('omega-3-ala');
  });
  it('collapses repeated hyphens', () => {
    expect(toSlug('A   B--C')).toBe('a-b-c');
  });
  it('strips leading/trailing hyphens', () => {
    expect(toSlug(' -hello- ')).toBe('hello');
  });
  it('handles common food names', () => {
    expect(toSlug('Spinach, raw')).toBe('spinach-raw');
    expect(toSlug("Brazil Nut")).toBe('brazil-nut');
  });
});
