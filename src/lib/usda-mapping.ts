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

  // Amino acids — nutrient numbers per USDA SR Legacy / FDC data dictionary.
  // Essential:
  '501': 'tryptophan',
  '502': 'threonine',
  '503': 'isoleucine',
  '504': 'leucine',
  '505': 'lysine',
  '506': 'methionine',
  '508': 'phenylalanine',
  '510': 'valine',
  '512': 'histidine',
  // Conditionally essential (USDA 507 is "cystine" — the disulfide dimer of
  // cysteine, the standard proxy for dietary cysteine in nutrient databases).
  // Glutamine (Gln) is NOT in this map on purpose: USDA reports only 515
  // "Glutamic acid", which via acid hydrolysis combines Glu + Gln (Glx) and
  // cannot be split into Gln. Curate glutamine via curated-food-nutrients.json.
  '507': 'cysteine',
  '509': 'tyrosine',
  '511': 'arginine',
  '516': 'glycine',
  '517': 'proline',
};

export function usdaNumberToSlug(num: string): string | null {
  return USDA_NUMBER_TO_SLUG[num] ?? null;
}
