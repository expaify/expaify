export const CITY_SLUGS: Record<string, string> = {
  'miami':      'Miami',
  'new-york':   'New York',
  'cancun':     'Cancún',
  'paris':      'Paris',
  'rome':       'Rome',
  'barcelona':  'Barcelona',
  'lisbon':     'Lisbon',
  'london':     'London',
  'tokyo':      'Tokyo',
  'bangkok':    'Bangkok',
  'dubai':      'Dubai',
  'las-vegas':  'Las Vegas',
  'orlando':    'Orlando',
  'san-juan':   'San Juan',
  'tulum':      'Tulum',
  'amsterdam':  'Amsterdam',
  'athens':     'Athens',
  'punta-cana': 'Punta Cana',
  'charlotte':  'Charlotte',
  'nashville':  'Nashville',
}

export const CITY_DISPLAY_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(CITY_SLUGS).map(([slug, name]) => [name, slug])
)
