// Part 1, step 2: pull the last DAYS days of posts from each subreddit and keep
// only the ones where someone could be asking for what you sell.
// Output: data/posts.json
import { writeFileSync } from 'node:fs';
import { SUBREDDITS, DAYS, PREFILTER } from './config.mjs';
import { dataPath, sleep } from './lib.mjs';

const API = 'https://arctic-shift.photon-reddit.com/api/posts/search';
const FIELDS = 'id,title,selftext,created_utc,author,subreddit,link_flair_text';
const after = Math.floor(Date.now() / 1000) - DAYS * 86400;

async function getPage(subreddit, before) {
  const params = new URLSearchParams({
    subreddit, after: String(after), limit: '100', sort: 'desc', fields: FIELDS,
  });
  if (before) params.set('before', String(before));
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': 'prospector/0.1 (local script)' } });
      const body = await res.json();
      if (res.ok && Array.isArray(body.data)) return body.data;
      // A 4xx is a bad request and retrying will not help, except the archive's
      // load-shedding reply (422 "Timeout. Maybe slow down a bit") and 429.
      const overloaded = res.status === 429 || /timeout|slow down/i.test(body.error ?? '');
      if (res.status >= 400 && res.status < 500 && !overloaded) {
        throw Object.assign(new Error(`r/${subreddit}: ${res.status} ${body.error ?? ''}`), { fatal: true });
      }
      // The archive answers "Timeout. Maybe slow down a bit" under load.
      console.warn(`  r/${subreddit}: ${res.status} ${body.error ?? ''} — retrying`);
    } catch (error) {
      if (error.fatal) throw error;
      console.warn(`  r/${subreddit}: ${error.message} — retrying`);
    }
    await sleep(5000 * (attempt + 1));
  }
  throw new Error(`r/${subreddit}: archive kept failing, giving up on this subreddit`);
}

const matchesAll = text =>
  Object.values(PREFILTER).every(group => group.some(re => re.test(text)));

const kept = [];
const stats = [];
for (const subreddit of SUBREDDITS) {
  let before, total = 0, matched = 0;
  try {
    for (;;) {
      const page = await getPage(subreddit, before);
      if (!page.length) break;
      total += page.length;
      for (const p of page) {
        const body = p.selftext && !['[removed]', '[deleted]'].includes(p.selftext) ? p.selftext : '';
        if (!matchesAll(`${p.title}\n${body}`)) continue;
        if (p.author === '[deleted]' && !body) continue;
        matched++;
        kept.push({
          id: p.id,
          url: `https://www.reddit.com/r/${p.subreddit}/comments/${p.id}/`,
          subreddit: p.subreddit,
          created: new Date(p.created_utc * 1000).toISOString(),
          title: p.title,
          body,
          flair: p.link_flair_text ?? '',
        });
      }
      const oldest = page.at(-1).created_utc;
      if (page.length < 100 || oldest <= after) break;
      before = oldest;
      await sleep(2000);
    }
  } catch (error) {
    console.error(`  ${error.message}`);
    stats.push({ subreddit, total, matched, error: error.message });
    continue;
  }
  stats.push({ subreddit, total, matched });
  console.log(`r/${subreddit}: ${total} posts in ${DAYS} days, ${matched} pass the pre-filter`);
}

// Same post can't appear twice across subreddits, but dedupe by id anyway.
const unique = [...new Map(kept.map(p => [p.id, p])).values()];
writeFileSync(dataPath('posts.json'), JSON.stringify(unique, null, 2));
writeFileSync(dataPath('fetch-stats.json'), JSON.stringify(stats, null, 2));
console.log(`\n${unique.length} posts written to data/posts.json`);
