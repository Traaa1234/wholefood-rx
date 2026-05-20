// USDA FDC nutrientNumber -> our nutrients.slug
// Reference: https://fdc.nal.usda.gov/portal-data/external/dataDictionary
export const USDA_NUMBER_TO_SLUG: Record<string, string> = {
  // Vitamins
  '320': 'vitamin-a',
  '404': 'vitamin-b1',
  '405': 'vitamin-b2',
  '406': 'vitamin-b3',
  '410': 'vitamin-b5',
  '415': 'vitamin-b6',
  '417': 'vitamin-b9',
  '418': 'vitamin-b12',
  '401': 'vitamin-c',
  '328': 'vitamin-d',
  '323': 'vitamin-e',
  '430': 'vitamin-k',
  '416': 'vitamin-b7',

  // Macro minerals
  '301': 'calcium',
  '305': 'phosphorus',
  '306': 'potassium',
  '307': 'sodium',
  '309': 'zinc',
  '312': 'copper',
  '315': 'manganese',
  '317': 'selenium',
  '303': 'iron',
  '304': 'magnesium',
  '313': 'fluoride',
  '314': 'chromium',

  // Fatty acids
  '675': 'omega-6',
  '851': 'omega-3-ala',
  '629': 'omega-3-epa',
  '621': 'omega-3-dha',

  // Selected essential amino acids
  '501': 'histidine',
  '502': 'isoleucine',
  '503': 'leucine',
  '504': 'lysine',
  '505': 'methionine',
  '506': 'phenylalanine',
  '507': 'threonine',
  '508': 'tryptophan',
  '509': 'valine',
};

export function usdaNumberToSlug(num: string): string | null {
  return USDA_NUMBER_TO_SLUG[num] ?? null;
}
