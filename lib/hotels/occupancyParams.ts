const OCCUPANCY_PARAM_KEYS = new Set([
  'occupancy',
  'occupancycount',
  'adult',
  'adults',
  'adultcount',
  'groupadults',
  'numberofadults',
  'child',
  'children',
  'childcount',
  'groupchildren',
  'numberofchildren',
  'childage',
  'childages',
  'agesofchildren',
  'infant',
  'infants',
  'infantage',
  'infantages',
  'room',
  'rooms',
  'roomcount',
  'roomqty',
  'roomquantity',
  'numberofrooms',
  'guest',
  'guests',
  'guestcount',
  'numberofguests',
  'pax',
  'traveler',
  'travelers',
  'traveller',
  'travellers',
])

/** Collapses casing, bracket notation, underscores, and punctuation so vendor
 * aliases such as child_ages[], CHILD_AGES, and childAges compare identically. */
export function normalizeHotelSearchParamKey(key: string): string {
  return key.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/[^a-z0-9]/g, '')
}

export function isHotelOccupancyParamKey(key: string): boolean {
  return OCCUPANCY_PARAM_KEYS.has(normalizeHotelSearchParamKey(key))
}
