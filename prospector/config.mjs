// Edit this file to retarget the job. Everything else reads from here.

// What you sell, in one plain sentence (used inside the "buying" question).
export const WHAT_I_SELL =
  'a roofer to fix a leaking metal, flat or commercial roof, or to handle a hail or wind damage roof insurance claim';

// Where buyers ask. Reddit is read through the Arctic Shift archive
// (reddit.com blocks this machine directly).
export const SUBREDDITS = [
  'Roofing',
  'PropertyManagement',
  'CommercialRealEstate',
  'Insurance',
  'landlord',
  'HomeImprovement',
  'smallbusiness',
  'Construction',
  'RealEstate',
];

export const DAYS = 30;

// Local pre-filter, so Jev only sees posts where someone could be ASKING for this.
// A post must match one pattern from EVERY group below.
export const PREFILTER = {
  topic: [/\broof(s|ing|er|ers)?\b/i],
  problem: [
    /\bleak(s|ing|y|ed|age)?\b/i,
    /\bhail\b/i,
    /\bwind damage\b/i,
    /\bstorm damage\b/i,
    /\binsurance claim\b/i,
    /\bwater (coming|getting|dripping|intrusion)\b/i,
  ],
  asking: [
    /\?/,
    /\bknow (a|of|any) good\b/i,
    /\blooking for (a|an|some)?\s*(good|reliable|recommend)/i,
    /\blooking for\b/i,
    /\brecommend(ation|ations|ed)?\b/i,
    /\bwho (do|would|should) (you|i) (use|call|hire)\b/i,
    /\bany(one)? (suggestions|advice|ideas|know)\b/i,
    /\bneed (a|an|someone|help)\b/i,
    /\bwhat (should|do|would) (i|you)\b/i,
  ],
};

// Jev questions (part 1). All three go in ONE call per post.
export const LEAD_QUESTIONS = {
  buying: {
    type: 'boolean',
    instructions: `The author is actively looking for ${WHAT_I_SELL} right now, and would welcome a reply offering one.`,
  },
  pain: {
    type: 'boolean',
    instructions: 'The author describes a problem they personally have today.',
  },
  vendor: {
    type: 'boolean',
    instructions: 'The author is promoting or selling their own product or service.',
  },
};

export const KEEP_IF = ({ buying, vendor }) => buying >= 0.6 && vendor < 0.5;

// Jev questions (part 2). Both go in ONE call per approved lead.
export const MESSAGE_QUESTIONS = {
  reply: {
    type: 'boolean',
    instructions: 'This person would reply to this message.',
  },
  fit: {
    type: 'boolean',
    instructions:
      "This message was written for someone in this person's role, with this person's problem.",
  },
};

export const FLAG_IF = ({ fit }) => fit < 0.5;

// Only send Jev the posts that explicitly ask for a pro (referral, "know a good...",
// "who do you use..."). Cuts calls ~10x; set to null to score every pre-filtered post.
export const ASK_FOR_PRO =
  /\b(know (a|of|any) good|recommend(ation|ations)?\s+(for|on)|any recommendations|who (do|would|should) (you|i) (use|call|hire)|looking for (a|an) (good|reliable|roofer|contractor|company)|need (a|an) (roofer|contractor|roofing)|(roofer|roofing (company|contractor)|contractor)s? (in|near|around)\b|hire (a|someone)|find (a|someone)|recommend (a|someone|any)|referral|who fixes|who (can|could) (fix|repair|look))/i;

// Vercel currently allows this account ONE successful Jev call per 5 minutes
// (measured 2026-09-26). While that holds, pace calls instead of bursting into 429s.
// Set to 0 once the limit is raised; CONCURRENCY then applies.
export const MIN_MS_BETWEEN_CALLS = 300_000;

export const CONCURRENCY = 3;
export const MAX_STATE_CHARS = 8000;
