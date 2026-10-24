import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultPreferences, PreferencesSchema, preferencesToInput, savedPreferences } from '../lib/preferences';
import { PlanInputSchema } from '../lib/agent/omnara-plan';

test('every onboarding answer reaches the validated agent input', () => {
  const preferences = PreferencesSchema.parse({ ...defaultPreferences('Joao'), city: 'San Francisco', date: '2026-11-01',
    interests: ['Chess', 'Brunch'], dislikes: ['Karaoke'], dietary: ['Vegetarian'], budget: 80,
    energy: 'Chill', travel: 3, vibe: 'Creative', budgetCap: 120, friendEmails: ['friend@example.com'],
    windowStart: '11:00', windowEnd: '16:00',
  });
  const input = PlanInputSchema.parse(preferencesToInput(preferences, 'joao@example.com'));
  assert.deepEqual(input.organizer, { name: 'Joao', email: 'joao@example.com' });
  assert.deepEqual(input.interests, ['Chess', 'Brunch']);
  assert.deepEqual(input.dislikes, ['Karaoke']);
  assert.deepEqual(input.dietary, ['Vegetarian']);
  assert.deepEqual(input.friendEmails, ['friend@example.com']);
  assert.equal(input.budgetCap, 120);
  assert.equal(input.city, preferences.city);
  assert.equal(input.date, preferences.date);
  assert.equal(input.timezone, preferences.timezone);
  assert.equal(input.windowStart, '11:00'); assert.equal(input.windowEnd, '16:00');
  assert.match(input.vibe!, /Creative.*Chill.*3 miles.*\$80.*\$120.*1 friend/);
});

test('account memory restores full answers even without the new profile columns', () => {
  const preferences = { ...defaultPreferences('Joao'), date: '2026-10-24', interests: ['Chess'], budget: 0, budgetCap: 0, energy: 'Chill' as const, travel: 2 };
  assert.deepEqual(savedPreferences({ city: 'Old city' }, { wondr_preferences: preferences }), preferences);
  const legacy = savedPreferences({ display_name: 'Joao', interests: ['Chess'], default_budget: 0, default_window_start: '11:00:00', default_window_end: '16:00:00' });
  assert.equal(legacy.budget, 0); assert.equal(legacy.windowStart, '11:00'); assert.equal(legacy.windowEnd, '16:00');
  assert.equal(legacy.name, 'Joao');
});

test('invalid times, contradictory interests and malformed friend emails cannot be saved', () => {
  const base = { ...defaultPreferences('Joao'), interests: ['Chess'] };
  for (const patch of [{ name: ' ' }, { interests: [] }, { dislikes: ['Chess'] }, { windowEnd: '08:00' }, { friendEmails: ['broken'] }, { timezone: 'invalid' }]) {
    assert.equal(PreferencesSchema.safeParse({ ...base, ...patch }).success, false);
  }
});
