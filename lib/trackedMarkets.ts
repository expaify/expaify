export type TrackedMarket = {
  city: string
  country: string
  iata: string
  photoUrl: string
  photoAlt: string
}

export const TRACKED_MARKETS: TrackedMarket[] = [
  { city: 'Miami', country: 'US', iata: 'MIA', photoUrl: 'https://images.unsplash.com/photo-1506966953602-c20cc11f75e3?auto=format&fit=crop&w=640&q=80', photoAlt: 'Miami shoreline at sunset' },
  { city: 'New York', country: 'US', iata: 'NYC', photoUrl: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=640&q=80', photoAlt: 'New York City skyline' },
  { city: 'Cancún', country: 'MX', iata: 'CUN', photoUrl: 'https://images.unsplash.com/photo-1552074284-5e88ef1aef18?auto=format&fit=crop&w=640&q=80', photoAlt: 'Cancun beach with turquoise water' },
  { city: 'Paris', country: 'FR', iata: 'PAR', photoUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=640&q=80', photoAlt: 'Eiffel Tower in Paris' },
  { city: 'Rome', country: 'IT', iata: 'ROM', photoUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=640&q=80', photoAlt: 'Colosseum in Rome' },
  { city: 'Barcelona', country: 'ES', iata: 'BCN', photoUrl: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=640&q=80', photoAlt: 'Barcelona city blocks and coast' },
  { city: 'Lisbon', country: 'PT', iata: 'LIS', photoUrl: 'https://images.unsplash.com/photo-1548707309-dcebeab9ea9b?auto=format&fit=crop&w=640&q=80', photoAlt: 'Lisbon hillside buildings' },
  { city: 'London', country: 'GB', iata: 'LON', photoUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=640&q=80', photoAlt: 'London bridge and skyline' },
  { city: 'Tokyo', country: 'JP', iata: 'TYO', photoUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=640&q=80', photoAlt: 'Tokyo street at night' },
  { city: 'Bangkok', country: 'TH', iata: 'BKK', photoUrl: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=640&q=80', photoAlt: 'Bangkok temple at dusk' },
  { city: 'Dubai', country: 'AE', iata: 'DXB', photoUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=640&q=80', photoAlt: 'Dubai skyline' },
  { city: 'Las Vegas', country: 'US', iata: 'LAS', photoUrl: 'https://images.unsplash.com/photo-1605833556294-ea5c7a74f57d?auto=format&fit=crop&w=640&q=80', photoAlt: 'Las Vegas strip at night' },
  { city: 'Orlando', country: 'US', iata: 'MCO', photoUrl: 'https://images.unsplash.com/photo-1597466599360-3b9775841aec?auto=format&fit=crop&w=640&q=80', photoAlt: 'Orlando lake and skyline' },
  { city: 'San Juan', country: 'PR', iata: 'SJU', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/City_Wall_-_Puerto_Rico.jpg/960px-City_Wall_-_Puerto_Rico.jpg', photoAlt: 'Sentry box at Castillo San Felipe del Morro, Old San Juan' },
  { city: 'Tulum', country: 'MX', iata: 'TQO', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Tulum_-_01.jpg/960px-Tulum_-_01.jpg', photoAlt: 'Tulum ruins overlooking the Caribbean coastline' },
  { city: 'Amsterdam', country: 'NL', iata: 'AMS', photoUrl: 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&w=640&q=80', photoAlt: 'Amsterdam canal houses' },
  { city: 'Athens', country: 'GR', iata: 'ATH', photoUrl: 'https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=640&q=80', photoAlt: 'Athens Acropolis' },
  { city: 'Punta Cana', country: 'DO', iata: 'PUJ', photoUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=640&q=80', photoAlt: 'Caribbean beach with palm trees' },
  { city: 'Charlotte', country: 'US', iata: 'CLT', photoUrl: 'https://images.unsplash.com/photo-1578439231583-9eca0a363860?auto=format&fit=crop&w=640&q=80', photoAlt: 'Charlotte skyline' },
  { city: 'Nashville', country: 'US', iata: 'BNA', photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Broadway_%28Nashville%29_lights.jpg/960px-Broadway_%28Nashville%29_lights.jpg', photoAlt: 'Broadway at night in Nashville, lined with music venues' },
  { city: 'Cairo', country: 'EG', iata: 'CAI', photoUrl: 'https://images.unsplash.com/photo-1539768942893-daf53e448371?auto=format&fit=crop&w=640&q=80', photoAlt: 'Camels beside the Pyramids of Giza' },
  { city: 'Hurghada', country: 'EG', iata: 'HRG', photoUrl: 'https://images.unsplash.com/photo-1667852976264-880d2d6ff8e5?auto=format&fit=crop&w=640&q=80', photoAlt: 'Red Sea waterfront tower' },
  { city: 'Sharm El Sheikh', country: 'EG', iata: 'SSH', photoUrl: 'https://images.unsplash.com/photo-1651871756929-09d7bde4e97d?auto=format&fit=crop&w=640&q=80', photoAlt: 'Red Sea coral reef with fish' },
  { city: 'Antalya', country: 'TR', iata: 'AYT', photoUrl: 'https://images.unsplash.com/photo-1648325129746-abcc1b872380?auto=format&fit=crop&w=640&q=80', photoAlt: 'Antalya old harbor with boats' },
  { city: 'Istanbul', country: 'TR', iata: 'IST', photoUrl: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=640&q=80', photoAlt: 'Galata Tower over the Istanbul skyline' },
  { city: 'Bodrum', country: 'TR', iata: 'BJV', photoUrl: 'https://images.unsplash.com/photo-1564166489229-dfb970a591bf?auto=format&fit=crop&w=640&q=80', photoAlt: 'Boat on the water near Bodrum' },
  { city: 'Bali (Denpasar)', country: 'ID', iata: 'DPS', photoUrl: 'https://images.unsplash.com/photo-1557093793-d149a38a1be8?auto=format&fit=crop&w=640&q=80', photoAlt: 'Tegalalang rice terraces near Ubud, Bali' },
  { city: 'Marrakech', country: 'MA', iata: 'RAK', photoUrl: 'https://images.unsplash.com/photo-1740381971575-92907071bc5f?auto=format&fit=crop&w=640&q=80', photoAlt: "Crowds gathered in Marrakech's main square at night" },
  { city: 'Mexico City', country: 'MX', iata: 'MEX', photoUrl: 'https://images.unsplash.com/photo-1747620612231-c598ff8abc65?auto=format&fit=crop&w=640&q=80', photoAlt: 'Angel of Independence monument lit at night in Mexico City' },
  { city: 'Santorini', country: 'GR', iata: 'JTR', photoUrl: 'https://images.unsplash.com/photo-1563789031959-4c02bcb41319?auto=format&fit=crop&w=640&q=80', photoAlt: "White and blue building overlooking Oia's blue church domes" },
  { city: 'Buenos Aires', country: 'AR', iata: 'BUE', photoUrl: 'https://images.unsplash.com/photo-1745409927264-0db48faf407b?auto=format&fit=crop&w=640&q=80', photoAlt: 'Obelisco de Buenos Aires under blue skies' },
  { city: 'Los Angeles', country: 'US', iata: 'LAX', photoUrl: 'https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?auto=format&fit=crop&w=640&q=80', photoAlt: 'Aerial view of the Hollywood Sign at golden hour' },
  { city: 'Chicago', country: 'US', iata: 'CHI', photoUrl: 'https://images.unsplash.com/photo-1493134799591-2c9eed26201a?auto=format&fit=crop&w=640&q=80', photoAlt: 'Chicago skyline across Lake Michigan' },
  { city: 'Vienna', country: 'AT', iata: 'VIE', photoUrl: 'https://images.unsplash.com/photo-1578400889704-bbd63485d516?auto=format&fit=crop&w=640&q=80', photoAlt: "St. Stephen's Cathedral in Vienna" },
  { city: 'Prague', country: 'CZ', iata: 'PRG', photoUrl: 'https://images.unsplash.com/photo-1755532883700-2dd663854b3b?auto=format&fit=crop&w=640&q=80', photoAlt: 'Charles Bridge with statues and Old Town Bridge Tower' },
  { city: 'Seoul', country: 'KR', iata: 'SEL', photoUrl: 'https://images.unsplash.com/photo-1674220710675-5a4322525c47?auto=format&fit=crop&w=640&q=80', photoAlt: 'Seoul city skyline at sunset' },
]

export const TRACKED_MARKET_NAMES = TRACKED_MARKETS.map((market) => market.city)
