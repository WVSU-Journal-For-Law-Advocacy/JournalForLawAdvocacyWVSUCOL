// Saturday morning (Philippine time), at most once a week: a gentle nudge for readers who opted in
// to streak reminders and haven't read this week yet.
import { db, devicesFor, send, isoWeek } from '../lib/push.mjs';

export const config = { schedule: '0 1 * * 6' }; // 01:00 UTC = 9:00 AM in Manila, Saturdays

export default async () => {
  const week = isoWeek();
  const devices = await devicesFor('streak');
  const uids = [...new Set(devices.map((d) => d.uid))];
  const due = [];
  for (const uid of uids) {
    const u = (await db().doc(`users/${uid}`).get()).data() || {};
    const secs = (u.weeks && u.weeks[week]) || 0;
    const streak = (u.stats && u.stats.streak) || 0;
    if (secs < 600) due.push({ uid, streak });
  }
  let sent = 0;
  for (const { uid, streak } of due) {
    sent += await send(devices.filter((d) => d.uid === uid), {
      title: streak ? `Keep your ${streak}-week streak` : 'A few minutes with the Journal?',
      body: streak ? 'Read for 10 minutes before Sunday ends to keep it going.' : 'Ten minutes of reading this week starts a streak.',
      url: '/account/', tag: 'streak',
    });
  }
  console.log(`streak nudges: ${sent} sent to ${due.length} readers (week ${week})`);
};
