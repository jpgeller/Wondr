# WONDR

An AI agent that plans a mystery day for you and your friends, books it, puts it on your calendar, and reveals it one stop at a time. Built at the Agent Builders Hackathon (Omnara), San Francisco.

- Full spec: [demo/WONDR_Project_Specs_v3.pdf](demo/WONDR_Project_Specs_v3.pdf)
- Contract: [demo/docs/contract.md](demo/docs/contract.md) (tables, routes, rules), with shapes in [demo/lib/types.ts](demo/lib/types.ts)
- Database: [demo/supabase/schema.sql](demo/supabase/schema.sql) (still the pre-v3 schema; the v3 tables are in contract.md)
- Env var names: [demo/.env.example](demo/.env.example)

All changes are made in `demo/` first. Once a change works there, it is copied into `main/`, the app Vercel deploys (Root Directory = `main`). The spec and presentation material also live in `demo/`.

## Who owns what

| | Person | Owns |
|---|---|---|
| A | _name_ | `lib/llm.ts`, `lib/agent/`, `lib/booking/`, `app/api/plan/`, `scripts/`: planner, tools, validation, re-plan, Exa + context.dev, booking tiers |
| B | Joao | `app/` (except `app/api/plan/`), `components/`, `lib/supabase/`, `lib/calendar/`, `supabase/schema.sql`: auth, four screens, reveals, demo mode, calendar, deploys |
| Both | | `docs/contract.md`, `lib/types.ts`, `.env.example`, `package.json`, `demo/` |

Before editing a shared file, say so in chat.

## Rung ladder

Each rung works in production before starting the next.

- [ ] 1. Deployed skeleton: live on Vercel, Google sign-in, database connected, both of us can deploy
- [ ] 2. Onboarding + plan generation: 4 to 6 real, validated stops saved
- [ ] 3. Teaser, staged reveals via realtime, demo mode (about 2 minutes)
- [ ] 4. Calendar: placeholders at plan time, patched at reveal
- [ ] 5. Reservations: one confirmed path with proof, plus fallbacks
- [ ] 6. Group join link + re-plan (running late / skip / swap)

Rungs 1 to 3 done by about 3:00. Feature freeze 4:15. Submit by 5:15 (closes 5:30).

## First hour checklist

- [ ] Decide A and B, put names in the table above
- [ ] Omnara: account at app.omnara.com, DM kart the org ID, get the key (A)
- [ ] Supabase: DM kart, create the project, run `schema.sql`, enable the Google provider (B)
- [ ] Google Cloud: OAuth app in **Testing** mode, add both of us and the demo accounts as test users (B)
- [ ] Vercel project, Root Directory `main`, env vars set; hello world deployed (B)
- [ ] context.dev credits redeemed; ask in Discord about Exa (A)
- [ ] Resend account (A)
- [ ] Read `contract.md` together and change anything either of us disagrees with

## Working rules

- Pull before you start, commit small, push every 30 to 45 minutes. Work on `main`; short branches only for risky experiments, merged back the same hour.
- Never commit keys. Real values in `demo/.env.local` (and `main/.env.local`) and Vercel. If a key leaks, rotate it right away.
- On a merge conflict, stop and fix it together. Never force push.
- Deploy often and check the live URL. Judges use the live app.

## Local setup

```bash
cd demo   # or main, for the promoted copy
cp .env.example .env.local   # fill in values
npm install
npm run dev
```
