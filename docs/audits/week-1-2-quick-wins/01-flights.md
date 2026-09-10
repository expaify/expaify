# Item 1 — flagged: intentional hotel search at /flights

The title and H1 match the current functionality. `components/search/SearchPanel.tsx:62-68` explicitly disables flight intent because the provider is unreliable and hardcodes `searchIntent = 'hotels'`. `app/flights/FlightsClient.tsx` defaults to hotel results and only displays flights for flight/trip intent. The navigation regression test also documents flights as contextual rather than a peer destination.

Do not relabel this as flight search or re-enable flights under this repair. The legacy URL/sitemap mismatch needs a separate routing/product decision.
