// Everything that makes this app "Venture Young Adults" lives here, in one
// place: names, crews, statuses, and the Planning Center ids it reads/writes.
// The server (api/) and the browser app (src/) both import this file.
//
// To run the app for another ministry, this is the file that changes, not
// the code. Nothing secret belongs here: keys and passwords stay in Vercel's
// environment variables.

export const MINISTRY = {
  name:      'Venture Young Adults',   // full name (AI suggestions, sign-in page)
  shortName: 'Venture YA',             // in leaders' default text message
  leaderNoun: 'YA leader',             // "from a YA leader" when a name is missing

  // People who can manage assignments and Leader status. Overridden by the
  // YA_ADMIN_PCO_IDS environment variable (comma-separated) when it's set.
  defaultAdminIds: ['83780614'],

  // ── Planning Center ────────────────────────────────────────────────────
  pco: {
    // Custom fields (Planning Center field definition ids). The app only ever
    // writes to these.
    fields: {
      crew:        '431524',    // Crew (select)
      status:      '1065431',   // YA Status (select): Active, Serving, Leader, Archived
      textMessage: '1151583',   // YA Text Message (a leader's own greeting template)
      nickname:    '1151595',   // YA Nickname (app-only)
    },
    // The follow-up workflow every connection card lands in.
    workflow: {
      id:           '806472',   // YA First-Time Guest Follow-Up
      stepWaiting:  '2247268',  // Waiting for Claim
      stepReachOut: '2247270',  // Reach Out
    },
    noteCategory: 'Young Adults',   // notes are written under this category
  },

  // ── YA Status values (as stored in Planning Center) ────────────────────
  statuses: {
    leader:   'Leader',                // can sign in to the app
    archived: 'Archived',              // hidden from the People list by default
    members:  ['Active', 'Serving'],   // counted as people in a crew
    // Everyone on the app's list. Older values still in PCO stay off it.
    all:      ['Active', 'Serving', 'Leader', 'Archived'],
  },

  // ── Crews ──────────────────────────────────────────────────────────────
  // key: the app's internal id (also sent to the Zapier "YA Mention" flow, so
  //      don't rename keys without updating that flow).
  // label: shown in the app and must match the Crew option in Planning Center
  //      (compared ignoring case and stray spaces).
  // badge: colour class in src/index.css.
  crews: [
    { key: 'college',     label: 'College Life',       badge: 'badge-college',  also: [] },
    { key: 'earlycareer', label: 'Early Career',       badge: 'badge-early',    also: [] },
    { key: 'youngpro',    label: 'Young Professional', badge: 'badge-youngpro', also: ['Young Professionals'] },
  ],

  // ── Texting leaders (Clearstream) ──────────────────────────────────────
  // The API key is secret and lives in Vercel (CLEARSTREAM_API_KEY), not here.
  texting: {
    from: '+14254751237',          // the YA line texts are sent from
    mentionHeader: 'YA Mention',   // shown in front of the text: "YA Mention: ..."
    newGuestHeader: 'YA New Guest',
    maxRecipients: 25,             // per note
    // Mentions written in these hours are held until morning, unless the
    // writer ticks "Send now".
    quietHours: { from: 21, until: 8, timeZone: 'America/Los_Angeles' },
  },

  // A new guest with no Crew gets one from their age (inclusive). Under the
  // lowest age, or no birthdate: no crew, and the admins are told instead.
  crewByAge: [
    { min: 18, max: 22, crew: 'college' },
    { min: 23, max: 27, crew: 'earlycareer' },
    { min: 28, max: 200, crew: 'youngpro' },
  ],

  // The text a leader sends a new guest unless they've saved their own.
  // {first} guest's first name · {me} leader's first name · {crew} "College Life crew"
  defaultTextMessage:
    "Hey {first}! It's {me} from Venture YA 👋 So glad you filled out a connection card! " +
    "I'd love to grab coffee or get you connected with {crew}. What does your week look like?",
}
