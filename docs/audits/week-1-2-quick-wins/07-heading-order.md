# Item 7 — flagged: separate hero preview, not a child of the live-deals section

`HomepageRedesign.tsx` renders a separate hero section (H1 plus preview DealCard), then a provider strip, then the live-deals section. The latter's H2 already precedes every DealCard H3 it contains. The hero preview's H3 does skip a level, but is not a child of the later section.

Moving the live-deals H2 above the hero card would alter the page structure/reading order and involve the excluded hero layout. CSS order would retain a conflicting visual/reading order. A smaller alternative is a configurable heading level on DealCard with an H2 for the standalone hero preview, but that is a different fix from the requested reorder. Flagged for clarification rather than forcing a structural change under this audit.
