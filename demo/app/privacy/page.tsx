// Public privacy policy, required by Google to publish the OAuth app.

export const metadata = { title: 'Privacy · WONDR' };

export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-5 leading-relaxed">
      <h1 className="text-3xl font-bold">WONDR privacy policy</h1>
      <p className="text-sm text-neutral-500">Last updated October 24, 2026</p>

      <p>
        WONDR plans a day out for you and adds it to your Google Calendar. This page explains what we collect, why, and
        how to remove it. WONDR is a hackathon project built at the Agent Builders Hackathon in San Francisco.
      </p>

      <h2 className="text-xl font-semibold">What we collect</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Your Google name and email address, to sign you in.</li>
        <li>The preferences you give us: area, free hours, interests, things to avoid, dietary needs, budget, energy level and travel distance.</li>
        <li>The plans we generate for you, and any friends&apos; email addresses you add to a plan.</li>
        <li>A Google refresh token for the Calendar permission, stored encrypted.</li>
      </ul>

      <h2 className="text-xl font-semibold">How we use Google data</h2>
      <p>
        We use the <code>calendar.events</code> permission only to create events for the stops of plans you ask for, and to
        update those events when a stop is revealed. We do not read, change or delete any other events. We do not sell your
        data, use it for advertising, or share it with anyone except the services that run WONDR: Supabase (database and
        sign-in), Vercel (hosting), Omnara (the planning agent), and the search providers the agent uses to find places.
        WONDR&apos;s use of information received from Google APIs adheres to the Google API Services User Data Policy,
        including the Limited Use requirements.
      </p>

      <h2 className="text-xl font-semibold">Deleting your data</h2>
      <p>
        You can remove WONDR&apos;s access at any time at{' '}
        <a className="underline" href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>. To delete
        your account, preferences and plans, email{' '}
        <a className="underline" href="mailto:joao.geller@uni.minerva.edu">joao.geller@uni.minerva.edu</a> and we will remove
        them within 7 days.
      </p>

      <h2 className="text-xl font-semibold">Contact</h2>
      <p>
        Questions: <a className="underline" href="mailto:joao.geller@uni.minerva.edu">joao.geller@uni.minerva.edu</a>
      </p>
    </main>
  );
}
