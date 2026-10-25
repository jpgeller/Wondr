'use client';

import { useState } from 'react';
import DayTimeline from '@/components/day-timeline';
import Onboarding from '@/components/onboarding';
import { defaultPreferences } from '@/lib/preferences';
import type { Plan } from '@/lib/types';
import seed from '@/lib/agent/seed/demo-plan.json';

// Sample stops let us review photos, ticket styling, and travel without buying
// tickets, changing an account, or spending credits on an agent run.
const plan: Plan = {
  title: 'A day for curiosity', teaser: 'Art, a good lunch, and a new challenge.', dressCode: 'Comfortable shoes', date: '2026-10-25',
  stops: [
    { ...seed.stops[3], position: 1, startsAt: '2026-10-25T10:00:00-07:00', endsAt: '2026-10-25T12:00:00-07:00',
      description: 'Wander through modern art and photography at your own pace. A quiet start for a curious morning.',
      admission: { kind: 'ticket', ticketUrl: 'https://www.sfmoma.org/tickets/' }, booking: { status: 'none' } },
    { ...seed.stops[2], position: 2, startsAt: '2026-10-25T12:30:00-07:00', endsAt: '2026-10-25T13:30:00-07:00',
      description: 'Settle in for fresh bread and a leisurely lunch. Save a little room for something sweet.',
      travelFromPrevious: { mode: 'driving', minutes: 15, distanceMiles: 2.5 }, admission: { kind: 'pay_on_site' }, booking: { status: 'none' } },
    { ...seed.stops[1], position: 3, startsAt: '2026-10-25T13:45:00-07:00', endsAt: '2026-10-25T15:00:00-07:00',
      description: 'Try a few beginner bouldering routes and find your rhythm. A playful way to end the afternoon.',
      travelFromPrevious: { mode: 'walking', minutes: 5, distanceMiles: 0.2 }, admission: { kind: 'ticket' }, booking: { status: 'none' } },
  ],
};

export default function DesignPreview() {
  const [form, setForm] = useState(false);
  if (form) return <Onboarding initial={defaultPreferences()} onSave={async () => {}} onGenerate={async () => setForm(false)} />;
  return <DayTimeline plan={plan} profile={{ city: 'San Francisco', date: plan.date, windowStart: '10:00', windowEnd: '15:00', interests: ['Art'], timezone: 'America/Los_Angeles' }}
    onBack={() => setForm(true)} onNewDay={() => setForm(true)} />;
}
