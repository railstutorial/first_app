import { experimental_evaluate as evaluate } from 'ai';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

export const DATA_DIR = new URL('./data/', import.meta.url);
mkdirSync(DATA_DIR, { recursive: true });
export const dataPath = name => new URL(name, DATA_DIR);

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function requireKey() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error('AI_GATEWAY_API_KEY is not set. Put it in prospector/.env and run with --env-file=.env');
    process.exit(1);
  }
}

// One Jev call. The gateway often answers 429 when Jev is busy, so back off and
// retry here instead of letting the SDK hammer it.
const BACKOFF_MS = [5_000, 10_000, 20_000, 40_000, 60_000, 60_000];

export async function jev(state, questions, backoff = BACKOFF_MS) {
  for (let attempt = 0; ; attempt++) {
    const started = performance.now();
    try {
      const result = await evaluate({ model: 'typesafe-ai/jev', state, questions, maxRetries: 0 });
      const probs = Object.fromEntries(
        Object.entries(result.answers).map(([id, a]) => [id, a.probability]),
      );
      return {
        ok: true,
        probs,
        ms: Math.round(performance.now() - started),
        cost: result.providerMetadata?.gateway?.cost,
      };
    } catch (error) {
      const rateLimited =
        error.statusCode === 429 || /RateLimit|high demand/i.test(`${error.name} ${error.message}`);
      if (rateLimited && attempt < backoff.length) {
        await sleep(backoff[attempt] + Math.random() * 1000);
        continue;
      }
      return { ok: false, error: `${error.name}: ${error.message}`, attempts: attempt + 1 };
    }
  }
}

// Run fn over items with at most `limit` in flight. With minGapMs > 0, run one
// at a time and wait minGapMs after each finishes (the limit window starts at
// the last successful call, which may come after several retries).
export async function pool(items, limit, fn, minGapMs = 0) {
  if (minGapMs > 0) {
    for (let i = 0; i < items.length; i++) {
      await fn(items[i], i);
      if (i < items.length - 1) await sleep(minGapMs);
    }
    return;
  }
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

export function csvCell(value) {
  const s = value === undefined || value === null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function writeCsv(path, header, rows) {
  const lines = [header.join(','), ...rows.map(r => header.map(h => csvCell(r[h])).join(','))];
  writeFileSync(path, lines.join('\n') + '\n');
}

// Minimal RFC 4180 parser (quoted fields, embedded commas/newlines).
export function readCsv(path) {
  const text = readFileSync(path, 'utf8');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some(v => v !== '')) rows.push(row); }
  const [header, ...body] = rows;
  return body.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

export function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
}

export const round = n => (typeof n === 'number' ? Math.round(n * 1000) / 1000 : n);
