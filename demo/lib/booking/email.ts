// Tier 3: reservation request by email through Resend. Reply-To is the organizer, so
// the venue's answer lands in a real inbox.

type ReservationEmail = {
  to: string;
  venueName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM local
  partySize: number;
  organizer: { name: string; email: string };
  dryRun: boolean;
};

export async function sendReservationEmail(req: ReservationEmail): Promise<{ id: string | null }> {
  const subject = `Reservation request: ${req.partySize} on ${req.date} at ${req.time}`;
  const text = `Hi ${req.venueName} team,

I'd like to book for ${req.partySize} ${req.partySize === 1 ? 'person' : 'people'} on ${req.date} at ${req.time}.
Could you confirm by replying to this email? If that time is full, any slot within 30 minutes works.

Thank you!
${req.organizer.name}
${req.organizer.email}

(Sent on ${req.organizer.name}'s behalf by WONDR.)`;

  if (req.dryRun) {
    console.log(`[booking] dry run, not sending to ${req.to}:\n${subject}\n${text}`);
    return { id: null };
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) throw new Error('RESEND_API_KEY and RESEND_FROM_EMAIL must be set');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to: [req.to], reply_to: req.organizer.email, subject, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return { id: data.id ?? null };
}
