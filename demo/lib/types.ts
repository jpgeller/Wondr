// Shared types for the contract in docs/contract.md (spec v3, section 5).
// Shared file: say in chat before editing. A writes it, both import from here.
//
// Every time is an ISO 8601 string with an offset, e.g. "2026-11-01T09:00:00-07:00".
// The only exceptions are PlanInput.windowStart / windowEnd, which are local "HH:MM"
// in PlanInput.timezone.

export type PlanInput = {
  date: string; // "2026-11-01"
  windowStart: string; // "09:00", local to timezone
  windowEnd: string; // "22:00"
  timezone?: string; // IANA, default "America/Los_Angeles"
  city: string; // city or neighborhood, free text
  interests: string[];
  dislikes?: string[];
  dietary?: string[];
  budgetCap?: number; // USD per person for the whole day
  vibe?: string;
  friendEmails?: string[];
  // Booking consent from the Plan my day form. Without it the agent never books.
  bookingConsent?: boolean;
  allowDeposit?: boolean; // may the agent submit a step that holds a card deposit
  // Who the reservation is under. The route fills this from the signed-in user.
  organizer?: { name: string; email: string };
};

export type StopBookingStatus = 'none' | 'pending' | 'confirmed' | 'walk_in' | 'failed';
export type BookingMethod = 'link' | 'email' | 'browser';

export type StopBooking = {
  status: StopBookingStatus;
  method?: BookingMethod;
  confirmationCode?: string;
  proofUrl?: string;
  bookingUrl?: string; // tier 1: the link the user taps to finish the booking
  note?: string; // short human line for the chip, e.g. "Request emailed, waiting on reply"
};

export type Stop = {
  position: number; // 1-based
  title: string; // "Sunrise yoga"
  category: string; // "fitness", "food", "culture" ...
  venueName: string;
  address: string;
  lat?: number;
  lng?: number;
  startsAt: string; // ISO with offset
  endsAt: string;
  description: string;
  sourceUrl?: string; // the search result the venue came from
  googlePlaceId?: string;
  travelFromPrevious?: { mode: 'walking' | 'driving'; minutes: number; distanceMiles: number }; // estimate, not live routing
  admission?: { kind: 'free' | 'ticket' | 'pay_on_site'; priceUsd?: number; ticketUrl?: string };
  booking: StopBooking;
};

export type Plan = {
  title: string;
  teaser: string;
  dressCode: string;
  date: string;
  stops: Stop[];
};

// ------------------------------------------------------------- plans table

export type PlanStatus = 'planning' | 'ready' | 'failed';

export type ProgressMessage = {
  at: string; // ISO
  message: string; // "Finding your brunch spot". Never a venue name.
  step?: string; // machine label, e.g. "search_venues"
};

export type PlanRow = {
  id: string;
  user_id: string;
  status: PlanStatus;
  input: PlanInput;
  result: Plan | null;
  progress: ProgressMessage[];
  error: string | null;
  created_at: string;
};

// --------------------------------------------------------------- API route

export type PlanRequest = { planId: string };

export type ReplanReason = 'running_late' | 'skip' | 'swap';

export type ReplanRequest = {
  planId: string;
  reason: ReplanReason;
  fromPosition: number; // first stop that may change
  delayMinutes?: number; // for running_late
  note?: string; // free text, e.g. "too tired for climbing"
};

export type ApiError = { error: string };

/** The reveal rule both sides use. Demo mode passes a fake `now`. */
export const REVEAL_LEAD_MINUTES = 45;

export function isRevealed(stop: Pick<Stop, 'startsAt'>, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(stop.startsAt).getTime() - REVEAL_LEAD_MINUTES * 60_000;
}
