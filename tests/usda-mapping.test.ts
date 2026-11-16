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

  // Amino-acid numbers must match USDA SR Legacy / FDC data dictionary exactly.
  // Verified against a live USDA FDC response for egg (fdcId 171287).
  it.each([
    ['501', 'tryptophan'],
    ['502', 'threonine'],
    ['503', 'isoleucine'],
    ['504', 'leucine'],
    ['505', 'lysine'],
    ['506', 'methionine'],
    ['507', 'cysteine'],
    ['508', 'phenylalanine'],
    ['509', 'tyrosine'],
    ['510', 'valine'],
    ['511', 'arginine'],
    ['512', 'histidine'],
    ['516', 'glycine'],
    ['517', 'proline'],
  ])('maps USDA %s to %s', (num, slug) => {
    expect(usdaNumberToSlug(num)).toBe(slug);
  });

  // USDA 515 is "Glutamic acid" = Glu+Gln combined (Glx) via acid hydrolysis.
  // Mapping it to our `glutamine` slug would be misleading — glutamine is
  // curated from literature instead. Lock this out.
  it('does not map USDA 515 (Glu+Gln combined) to glutamine', () => {
    expect(usdaNumberToSlug('515')).toBeNull();
  });
});
