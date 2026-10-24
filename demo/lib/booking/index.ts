// Reservation pipeline (spec section 9). Tiers in the order we try them:
//
//   1  link     prefilled deep link to the venue's booking page; the user taps to finish
//   3  email    reservation request through Resend, replies go to the organizer
//   5  walk_in  the venue takes walk-ins, nothing to book
//
// Tier 2 (browser agent) and tier 4 (voice) are not built yet. A stop that fails every
// tier comes back `failed`, and the planner swaps in a walk-in venue.
//
// Rules: book only with consent, never touch payment or CAPTCHA steps, and never book a
// stop that already has a booking (idempotent across retries). BOOKING_DRY_RUN=true
// (the default) builds everything but sends nothing.

import type { PlanInput, Stop, StopBooking } from '../types';
import { localHHMM, DEFAULT_TZ } from '../agent/time';
import { sendReservationEmail } from './email';
import { prefillBookingUrl } from './link';

/** What the planner learned about a venue while validating it. Not part of the Plan. */
export type VenueFacts = {
  needsReservation: boolean;
  walkInsOk: boolean;
  bookingUrl: string | null;
  contactEmail: string | null;
  pricePerPersonUsd: number | null;
};

export const isDryRun = () => process.env.BOOKING_DRY_RUN !== 'false';

const DONE: StopBooking['status'][] = ['pending', 'confirmed', 'walk_in'];

export async function bookStop(stop: Stop, facts: VenueFacts, input: PlanInput): Promise<StopBooking> {
  if (DONE.includes(stop.booking.status)) return stop.booking; // idempotency: never double book
  if (!facts.needsReservation) {
    return { status: 'walk_in', note: 'No reservation needed' };
  }
  if (!input.bookingConsent) {
    return { status: 'none', note: 'Booking not authorized' };
  }

  const tz = input.timezone ?? DEFAULT_TZ;
  const partySize = 1 + (input.friendEmails?.length ?? 0);

  // Tier 1: deep link.
  if (facts.bookingUrl) {
    return {
      status: 'pending',
      method: 'link',
      bookingUrl: prefillBookingUrl(facts.bookingUrl, { startsAt: stop.startsAt, partySize, tz }),
      note: 'Tap to confirm the table',
    };
  }

  // Tier 3: email request.
  if (facts.contactEmail && input.organizer) {
    try {
      const { id } = await sendReservationEmail({
        to: facts.contactEmail,
        venueName: stop.venueName,
        date: input.date,
        time: localHHMM(stop.startsAt, tz),
        partySize,
        organizer: input.organizer,
        dryRun: isDryRun(),
      });
      return {
        status: 'pending',
        method: 'email',
        confirmationCode: id ?? undefined,
        note: isDryRun() ? 'Dry run: request written, not sent' : 'Request emailed, replies go to you',
      };
    } catch (err) {
      console.error('[booking] email tier failed', err);
    }
  }

  // Tier 5: walk-in.
  if (facts.walkInsOk) return { status: 'walk_in', note: 'Takes walk-ins' };

  return { status: 'failed', note: 'Could not book' };
}
