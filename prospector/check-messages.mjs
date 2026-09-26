// Part 2: check each approved message BEFORE you send it by hand.
// This script never sends, posts or DMs anything.
// Input:  approved.csv with columns url, who, message
// Output: checked.csv (url, who, message, reply, fit, verdict)
import { existsSync } from 'node:fs';
import { MESSAGE_QUESTIONS, FLAG_IF, CONCURRENCY } from './config.mjs';
import { jev, pool, readCsv, requireKey, round, writeCsv } from './lib.mjs';

requireKey();

const input = new URL('./approved.csv', import.meta.url);
if (!existsSync(input)) {
  console.error('Missing approved.csv. Copy approved.example.csv and fill in url, who, message.');
  process.exit(1);
}
const leads = readCsv(input).filter(l => l.who && l.message);
console.log(`${leads.length} approved leads to check (${CONCURRENCY} at a time)`);

const rows = [];
await pool(leads, CONCURRENCY, async lead => {
  const state = `LEAD: ${lead.who} / MESSAGE THEY ARE ABOUT TO RECEIVE: ${lead.message}`;
  const r = await jev(state, MESSAGE_QUESTIONS);
  if (!r.ok) {
    rows.push({ ...lead, verdict: `NOT CHECKED (${r.error})` });
    return;
  }
  const scores = { reply: round(r.probs.reply), fit: round(r.probs.fit) };
  const verdict = FLAG_IF(scores)
    ? 'FLAG: do not send (message does not fit this person)'
    : 'ok to review and send by hand';
  rows.push({ ...lead, ...scores, verdict });
  console.log(`reply ${scores.reply}  fit ${scores.fit}  ${verdict}  ${lead.url}`);
});

rows.sort((a, b) => (a.fit ?? -1) - (b.fit ?? -1));
writeCsv(new URL('./checked.csv', import.meta.url), ['url', 'who', 'message', 'reply', 'fit', 'verdict'], rows);
console.log(`\nWrote checked.csv. Flagged: ${rows.filter(r => r.verdict.startsWith('FLAG')).length}. Nothing was sent.`);
