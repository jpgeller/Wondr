// A fixed plan that follows the contract exactly, so the UI can be built before the real
// agent works. Real San Francisco venues, times built on the requested date, and one
// stop of each booking status so every chip can be styled.

import type { Plan, PlanInput } from '../types';
import { DEFAULT_TZ, localToDate, toZonedISO } from './time';

export function mockPlan(input: Pick<PlanInput, 'date' | 'timezone'>): Plan {
  const tz = input.timezone ?? DEFAULT_TZ;
  const at = (hhmm: string) => toZonedISO(localToDate(input.date, hhmm, tz), tz);

  return {
    title: 'The Long Way Around',
    teaser: 'Fog in the morning, color in the afternoon, and a table waiting at the end.',
    dressCode: 'Athleisure you can sit down to lunch in, plus a warm layer for the evening',
    date: input.date,
    stops: [
      {
        position: 1,
        title: 'Cliffside morning walk',
        category: 'outdoors',
        venueName: 'Lands End Trail',
        address: '680 Point Lobos Ave, San Francisco, CA 94121',
        lat: 37.7802,
        lng: -122.5116,
        startsAt: at('09:00'),
        endsAt: at('10:15'),
        description: 'Start at the Lands End Lookout and follow the coastal trail to the labyrinth at Mile Rock. Go early, before the fog lifts.',
        sourceUrl: 'https://www.nps.gov/goga/planyourvisit/landsend.htm',
        booking: { status: 'walk_in', note: 'No reservation needed' },
      },
      {
        position: 2,
        title: 'Up the wall',
        category: 'fitness',
        venueName: 'Touchstone Mission Cliffs',
        address: '2295 Harrison St, San Francisco, CA 94110',
        lat: 37.7609,
        lng: -122.4127,
        startsAt: at('10:45'),
        endsAt: at('12:00'),
        description: 'Day passes and rental shoes at the front desk. Stick to the bouldering cave if nobody has climbed before.',
        sourceUrl: 'https://touchstoneclimbing.com/mission-cliffs/',
        booking: { status: 'confirmed', method: 'browser', confirmationCode: 'MC-4821', note: 'Day passes reserved' },
      },
      {
        position: 3,
        title: 'Bread worth the line',
        category: 'food',
        venueName: 'Tartine Manufactory',
        address: '595 Alabama St, San Francisco, CA 94110',
        lat: 37.7618,
        lng: -122.4117,
        startsAt: at('12:15'),
        endsAt: at('13:30'),
        description: 'Order the country bread with butter for the table and a morning bun each. Walk two blocks from the climbing gym.',
        sourceUrl: 'https://tartinebakery.com/locations/manufactory',
        booking: { status: 'walk_in', note: 'Takes walk-ins' },
      },
      {
        position: 4,
        title: 'Seven floors of color',
        category: 'culture',
        venueName: 'SFMOMA',
        address: '151 3rd St, San Francisco, CA 94103',
        lat: 37.7857,
        lng: -122.4011,
        startsAt: at('14:00'),
        endsAt: at('16:00'),
        description: 'Head straight to the living wall on floor three, then take the stairs down through the photography galleries.',
        sourceUrl: 'https://www.sfmoma.org/visit/',
        booking: {
          status: 'pending',
          method: 'link',
          bookingUrl: 'https://www.sfmoma.org/tickets/',
          note: 'Tap to confirm the tickets',
        },
      },
      {
        position: 5,
        title: 'Learn the steps',
        category: 'class',
        venueName: 'Dance Mission Theater',
        address: '3316 24th St, San Francisco, CA 94110',
        lat: 37.7524,
        lng: -122.4198,
        startsAt: at('16:45'),
        endsAt: at('18:00'),
        description: 'A drop-in salsa class for total beginners. Partners rotate, so nobody gets stuck with anyone.',
        sourceUrl: 'https://dancemission.com/',
        booking: { status: 'pending', method: 'email', note: 'Request emailed, replies go to you' },
      },
      {
        position: 6,
        title: 'The table at the end',
        category: 'food',
        venueName: 'Nopa',
        address: '560 Divisadero St, San Francisco, CA 94117',
        lat: 37.7749,
        lng: -122.4376,
        startsAt: at('19:00'),
        endsAt: at('21:00'),
        description: 'Wood-fired California cooking. Get the flatbread and the pork chop to share, and save room for dessert.',
        sourceUrl: 'https://nopasf.com/',
        booking: { status: 'failed', note: 'Could not book' },
      },
    ],
  };
}
