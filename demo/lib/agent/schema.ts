// Runtime validation for the Plan type in lib/types.ts. Nothing reaches plans.result
// without passing PlanSchema, so a malformed plan never reaches the UI.

import { z } from 'zod';
import type { Plan } from '../types';

const isoWithOffset = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/, 'ISO 8601 with offset');

export const StopBookingSchema = z.object({
  status: z.enum(['none', 'pending', 'confirmed', 'walk_in', 'failed']),
  method: z.enum(['link', 'email', 'browser']).optional(),
  confirmationCode: z.string().optional(),
  proofUrl: z.string().optional(),
  bookingUrl: z.string().optional(),
  note: z.string().optional(),
});

export const StopSchema = z.object({
  position: z.number().int().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  venueName: z.string().min(1),
  address: z.string().min(1),
  lat: z.number().optional(),
  lng: z.number().optional(),
  startsAt: isoWithOffset,
  endsAt: isoWithOffset,
  description: z.string(),
  sourceUrl: z.string().optional(),
  googlePlaceId: z.string().regex(/^[A-Za-z0-9_-]+$/).max(300).optional(),
  travelFromPrevious: z.object({
    mode: z.enum(['walking', 'driving']),
    minutes: z.number().int().min(1).max(300),
    distanceMiles: z.number().min(0).max(200),
  }).optional(),
  admission: z.object({
    kind: z.enum(['free', 'ticket', 'pay_on_site']),
    priceUsd: z.number().nonnegative().optional(),
    ticketUrl: z.url().refine((url) => /^https?:\/\//i.test(url), 'Use an HTTP or HTTPS ticket link').optional(),
  }).optional(),
  booking: StopBookingSchema,
});

export const PlanSchema = z
  .object({
    title: z.string().min(1),
    teaser: z.string().min(1),
    dressCode: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    stops: z.array(StopSchema).min(1).max(8),
  })
  .superRefine((plan, ctx) => {
    plan.stops.forEach((s, i) => {
      if (s.position !== i + 1) ctx.addIssue({ code: 'custom', message: `stop ${i + 1} has position ${s.position}` });
      if (new Date(s.endsAt) <= new Date(s.startsAt))
        ctx.addIssue({ code: 'custom', message: `stop ${s.position} ends before it starts` });
      const prev = plan.stops[i - 1];
      if (prev && new Date(s.startsAt) < new Date(prev.endsAt))
        ctx.addIssue({ code: 'custom', message: `stop ${s.position} overlaps stop ${prev.position}` });
    });
  });

export function validatePlan(plan: unknown): Plan {
  return PlanSchema.parse(plan) as Plan;
}
