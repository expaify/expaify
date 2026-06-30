export type TripInspirationTheme = 'beach' | 'city' | 'food' | 'culture' | 'outdoors' | 'last_minute';

export type TripInspirationItem = {
  id: string;
  theme: TripInspirationTheme;
  label: string;
  originIata: string;
  destinationIata: string;
  destinationCity: string;
  destinationCountry: string;
  minNights: number;
  maxNights: number;
  suggestedMonth: string;
  priceHintUsd: number;
};

type InspirationTemplate = Omit<TripInspirationItem, 'id' | 'originIata' | 'suggestedMonth'> & {
  daysFromToday: number;
};

const RECOMMENDATIONS: Record<string, InspirationTemplate[]> = {
  NYC: [
    template('culture', 'Museum weekend', 'YUL', 'Montreal', 'Canada', 3, 5, 64, 260),
    template('food', 'Culinary break', 'MSY', 'New Orleans', 'United States', 3, 4, 92, 230),
    template('beach', 'Island reset', 'SJU', 'San Juan', 'Puerto Rico', 4, 7, 127, 310),
    template('city', 'Design district hop', 'YYZ', 'Toronto', 'Canada', 2, 4, 36, 210),
  ],
  LAX: [
    template('culture', 'Gallery long weekend', 'MEX', 'Mexico City', 'Mexico', 4, 6, 58, 290),
    template('food', 'Pacific Northwest tasting', 'PDX', 'Portland', 'United States', 3, 5, 84, 180),
    template('beach', 'Baja coast', 'SJD', 'San Jose del Cabo', 'Mexico', 4, 7, 121, 240),
    template('outdoors', 'Red rocks escape', 'SLC', 'Salt Lake City', 'United States', 3, 5, 41, 190),
  ],
  SFO: [
    template('city', 'Harbor city reset', 'YVR', 'Vancouver', 'Canada', 3, 5, 48, 220),
    template('food', 'Northwest food crawl', 'PDX', 'Portland', 'United States', 2, 4, 76, 170),
    template('outdoors', 'Desert hiking base', 'PHX', 'Phoenix', 'United States', 3, 5, 104, 210),
    template('culture', 'Capital museums', 'MEX', 'Mexico City', 'Mexico', 4, 6, 137, 330),
  ],
  CHI: [
    template('city', 'Northeast city break', 'BOS', 'Boston', 'United States', 3, 5, 34, 190),
    template('food', 'Southern tables', 'MSY', 'New Orleans', 'United States', 3, 4, 69, 210),
    template('outdoors', 'Mountain air', 'DEN', 'Denver', 'United States', 3, 6, 112, 180),
    template('culture', 'Old town galleries', 'YUL', 'Montreal', 'Canada', 4, 6, 146, 250),
  ],
  MIA: [
    template('culture', 'Walled city weekend', 'CTG', 'Cartagena', 'Colombia', 4, 6, 52, 310),
    template('beach', 'Caribbean quick hop', 'NAS', 'Nassau', 'Bahamas', 3, 5, 81, 240),
    template('food', 'Yucatan flavors', 'CUN', 'Cancun', 'Mexico', 4, 7, 118, 260),
    template('city', 'Island city break', 'SJU', 'San Juan', 'Puerto Rico', 3, 5, 39, 190),
  ],
  DFW: [
    template('culture', 'Capital galleries', 'MEX', 'Mexico City', 'Mexico', 4, 6, 44, 260),
    template('outdoors', 'High desert weekend', 'ABQ', 'Albuquerque', 'United States', 3, 5, 73, 190),
    template('food', 'Creole food run', 'MSY', 'New Orleans', 'United States', 3, 4, 102, 170),
    template('beach', 'Gulf coast reset', 'TPA', 'Tampa', 'United States', 4, 6, 136, 210),
  ],
  SEA: [
    template('city', 'Canadian city hop', 'YVR', 'Vancouver', 'Canada', 2, 4, 33, 160),
    template('outdoors', 'Rocky Mountain base', 'DEN', 'Denver', 'United States', 3, 6, 67, 210),
    template('food', 'Bay Area tables', 'SFO', 'San Francisco', 'United States', 3, 5, 98, 190),
    template('culture', 'Mexico City galleries', 'MEX', 'Mexico City', 'Mexico', 4, 6, 142, 340),
  ],
  BOS: [
    template('culture', 'Quebec long weekend', 'YQB', 'Quebec City', 'Canada', 3, 5, 46, 230),
    template('city', 'Lakeside city break', 'YYZ', 'Toronto', 'Canada', 3, 5, 79, 210),
    template('food', 'Lowcountry tables', 'CHS', 'Charleston', 'United States', 3, 4, 109, 220),
    template('beach', 'Caribbean reset', 'SJU', 'San Juan', 'Puerto Rico', 4, 7, 149, 300),
  ],
  ATL: [
    template('food', 'Creole weekend', 'MSY', 'New Orleans', 'United States', 3, 4, 31, 160),
    template('beach', 'Island short break', 'NAS', 'Nassau', 'Bahamas', 3, 5, 62, 230),
    template('culture', 'Historic coast', 'CHS', 'Charleston', 'United States', 2, 4, 96, 150),
    template('outdoors', 'Mountain city base', 'DEN', 'Denver', 'United States', 4, 6, 130, 220),
  ],
  DEN: [
    template('outdoors', 'Canyon weekend', 'LAS', 'Las Vegas', 'United States', 3, 5, 37, 170),
    template('city', 'Pacific harbor break', 'SAN', 'San Diego', 'United States', 3, 5, 71, 210),
    template('food', 'Austin tables', 'AUS', 'Austin', 'United States', 3, 4, 106, 180),
    template('culture', 'Northern capital hop', 'YUL', 'Montreal', 'Canada', 4, 6, 144, 280),
  ],
};

const FALLBACK: InspirationTemplate[] = [
  template('city', 'Easy city break', 'BOS', 'Boston', 'United States', 3, 5, 45, 220),
  template('food', 'Southern food weekend', 'MSY', 'New Orleans', 'United States', 3, 4, 83, 240),
  template('outdoors', 'Mountain base', 'DEN', 'Denver', 'United States', 4, 6, 116, 260),
  template('beach', 'Caribbean reset', 'SJU', 'San Juan', 'Puerto Rico', 4, 7, 148, 320),
];

const CITY_ALIASES: Record<string, string> = {
  EWR: 'NYC',
  JFK: 'NYC',
  LGA: 'NYC',
  MDW: 'CHI',
  ORD: 'CHI',
};

export function getTripInspiration(originIata: string, today = new Date()): TripInspirationItem[] {
  const normalizedOrigin = originIata.trim().toUpperCase();
  const recommendationKey = CITY_ALIASES[normalizedOrigin] ?? normalizedOrigin;
  const templates = RECOMMENDATIONS[recommendationKey] ?? FALLBACK;
  const itemOrigin = recommendationKey || 'NYC';

  return templates.map((item) => ({
    id: `${itemOrigin.toLowerCase()}-${item.destinationIata.toLowerCase()}-${item.theme}`,
    theme: item.theme,
    label: item.label,
    originIata: itemOrigin,
    destinationIata: item.destinationIata,
    destinationCity: item.destinationCity,
    destinationCountry: item.destinationCountry,
    minNights: item.minNights,
    maxNights: item.maxNights,
    suggestedMonth: formatMonth(addDays(today, clamp(item.daysFromToday, 30, 150))),
    priceHintUsd: item.priceHintUsd,
  }));
}

function template(
  theme: TripInspirationTheme,
  label: string,
  destinationIata: string,
  destinationCity: string,
  destinationCountry: string,
  minNights: number,
  maxNights: number,
  daysFromToday: number,
  priceHintUsd: number,
): InspirationTemplate {
  return {
    theme,
    label,
    destinationIata,
    destinationCity,
    destinationCountry,
    minNights,
    maxNights,
    daysFromToday,
    priceHintUsd,
  };
}

function addDays(date: Date, days: number): Date {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
