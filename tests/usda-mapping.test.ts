import { describe, it, expect } from 'vitest';
import { usdaNumberToSlug, USDA_NUMBER_TO_SLUG } from '@/lib/usda-mapping';

describe('USDA nutrient mapping', () => {
  it('maps Vitamin C', () => {
    expect(usdaNumberToSlug('401')).toBe('vitamin-c');
  });
  it('maps Iron, Fe', () => {
    expect(usdaNumberToSlug('303')).toBe('iron');
  });
  it('maps Calcium, Ca', () => {
    expect(usdaNumberToSlug('301')).toBe('calcium');
  });
  it('returns null for unknown numbers', () => {
    expect(usdaNumberToSlug('99999')).toBeNull();
  });
  it('table has no duplicate slugs', () => {
    const slugs = Object.values(USDA_NUMBER_TO_SLUG);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
