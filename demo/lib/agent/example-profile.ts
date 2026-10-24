import type { PlanInput } from '../types';

export function exampleProfile(): PlanInput {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return {
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(tomorrow),
    windowStart: '10:00', windowEnd: '17:00', timezone: 'America/Los_Angeles',
    city: 'Mission District, San Francisco',
    interests: ['chess', 'running', 'trying new restaurants'],
    vibe: 'Joao is going alone. Keep the outing relaxed, nearby, and solo-friendly.',
  };
}

// Vercel Authentication protects previews. This route is never public in production.
export function cloudTestEnabled() {
  return process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development';
}
