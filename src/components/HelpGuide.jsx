import { useState } from 'react'
import { Link2, Share } from 'lucide-react'
import { Flag, UserCheck, MessageCircle, Check, UserRoundSearch, Hand, Clock, MessageCircleHeart } from 'lucide-react'

// "How the YA Toolkit works" — the leader guide, opened from Profile.
// Mirrors the shared YA Toolkit Leader Guide doc; keep the two in step.
// The pictures are small live replicas of the real screens (same styles, a
// made-up guest), so they never show a real person and never go stale.
const G = 'Jordan'

function Shot({ caption, children }) {
  return (
    <figure className="help-shot">
      <div className="help-shot-screen" aria-hidden="true">{children}</div>
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

const ClaimShot = () => (
  <Shot caption="A new guest, waiting for a leader">
    <div className="fu-card">
      <div className="fu-head"><Flag className="fu-icon" />
        <div><div className="fu-title">New connection card</div><div className="fu-sub">2h ago · not claimed yet</div></div>
      </div>
      <div className="fu-log help-fake-btn">Claim {G}</div>
    </div>
  </Shot>
)
const TextShot = () => (
  <Shot caption="Claimed by you: tap Text to open Messages">
    <div className="fu-card fu-card-mine">
      <div className="fu-head"><UserCheck className="fu-icon fu-icon-mine" size={22} />
        <div style={{ flex: 1 }}><div className="fu-title">Claimed by you</div><div className="fu-sub">Just now</div></div>
        <span className="fu-btn-release">Release</span>
      </div>
      <div className="fu-btn-row">
        <div className="fu-log fu-log-mine fu-text-btn help-fake-btn"><MessageCircle size={16} /> Text {G}</div>
        <span className="fu-btn-takeover fu-btn-marktexted"><Check size={15} strokeWidth={3} /> Mark as texted</span>
      </div>
    </div>
  </Shot>
)
const ConfirmShot = () => (
  <Shot caption="Confirm it, and the card turns green">
    <div className="fu-card fu-card-mine">
      <div className="fu-head"><MessageCircle className="fu-icon fu-icon-mine" size={22} />
        <div><div className="fu-title">Did you send the text to {G}?</div><div className="fu-sub">Only the time is saved, not your message.</div></div>
      </div>
      <div className="fu-btn-row"><div className="fu-log fu-log-mine help-fake-btn">Yes, I sent it</div><span className="fu-btn-release help-fake-pill">Not yet</span></div>
    </div>
    <div className="fu-card fu-card-done">
      <div className="fu-head"><Check className="fu-icon fu-icon-done" size={22} strokeWidth={3} />
        <div><div className="fu-title">Texted by you</div><div className="fu-sub">Today · 3h after their connection card</div></div>
      </div>
    </div>
  </Shot>
)
const HomeShot = () => (
  <Shot caption="The four tiles at the top of Home">
    <div className="stat-grid help-stat-grid">
      <div className="stat stat-amber"><UserRoundSearch size={18} /><span className="stat-num">2</span><span className="stat-label">Not claimed</span></div>
      <div className="stat stat-indigo"><Hand size={18} /><span className="stat-num">1</span><span className="stat-label">Yours to text</span></div>
      <div className="stat"><Clock size={18} /><span className="stat-num">3</span><span className="stat-label">Claimed by others</span></div>
      <div className="stat stat-green"><MessageCircleHeart size={18} /><span className="stat-num">5</span><span className="stat-label">Texted · 30 days</span></div>
    </div>
  </Shot>
)
const SmsShot = () => (
  <Shot caption="Texts from the YA line: a new guest, and an @mention">
    <div className="help-sms">
      <div className="help-sms-from">Venture YA</div>
      <div className="help-sms-bubble">YA New Guest: Jordan Rivera (College Life) filled out a card. Claim &amp; text them: ya-toolkit.vercel.app/p/…</div>
      <div className="help-sms-bubble">YA Mention: Chris mentioned you on Jordan: "Can you grab coffee with him this week?" ya-toolkit.vercel.app/p/…</div>
    </div>
  </Shot>
)
const MentionShot = () => (
  <Shot caption="Type @ in a note to pick a leader or a whole crew">
    <div className="note-compose help-compose">
      <div className="note-compose-input help-fake-input">Can <span className="mention">@Early Career</span> help Jordan find a crew?</div>
    </div>
    <div className="mention-quiet"><span>Quiet hours (9pm–8am): mention notifications go out at 8am.</span><span className="mention-quiet-toggle"><input type="checkbox" readOnly tabIndex={-1} /> Send now</span></div>
  </Shot>
)
const HOME_ROWS = [
  ['Not claimed', 'New connection cards no leader has taken yet', 'Claim the ones in your crew'],
  ['Yours to text', "Guests you claimed but haven't marked as texted", 'Text them, then confirm in the app'],
  ['Claimed by others', "Guests another leader claimed and hasn't texted yet", "Nothing, unless they've waited a while. Nudge them with an @mention"],
  ['Texted · 30 days', 'Guests a leader contacted in the last 30 days', 'Nothing. This is the win column'],
]

// Short link that opens this guide (after sign-in): /help → /people#/help
const GUIDE_URL = `${window.location.origin}/help`

function ShareGuide() {
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && !!navigator.share
  async function share() {
    if (canShare) {
      try { await navigator.share({ title: 'How the YA Toolkit works', url: GUIDE_URL }); return } catch { return }
    }
    await navigator.clipboard?.writeText(GUIDE_URL)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button type="button" className={`copy-link-btn help-share${copied ? ' copied' : ''}`} onClick={share}>
      {copied ? <><Check size={13} />Link copied</> : canShare ? <><Share size={13} />Share this guide</> : <><Link2 size={13} />Copy link to this guide</>}
    </button>
  )
}

const STATUS_ROWS = [
  ['Active', 'Coming around and getting connected'],
  ['Serving', 'On a YA team'],
  ['Leader', 'A YA leader: can sign in to this app (admins set this)'],
  ['Archived', "Moved on or no longer connected. Hidden from lists, but nothing's deleted"],
]

export default function HelpGuide({ isAdmin = false }) {
  return (
    <div className="help-guide">
      <ShareGuide />
      <p className="help-lead">
        When a young adult fills out a connection card, a leader from their crew claims them here,
        texts them, and marks it done, ideally within a day. Notes and @mentions keep everyone in the loop.
      </p>

      <section className="home-section">
        <div className="home-section-head"><h2>Following up with a new guest</h2></div>
        <ol className="help-card help-steps">
          <li>A guest fills out a connection card. They show up under <b>Not claimed</b>, and their crew's leaders get a text with a link.</li>
          <li>Open the guest and tap <b>Claim</b>. The card turns purple: <b>Claimed by you</b>. Can't follow up after all? Tap <b>Release</b>.<ClaimShot /></li>
          <li>Tap <b>Text</b>. Messages opens with your saved message filled in. Tweak it and send. Already texted them from your own phone? Tap <b>Mark as texted</b> instead.<TextShot /></li>
          <li>Back here, answer <b>Did you send the text?</b> with <b>Yes, I sent it</b>. The card turns green.<ConfirmShot /></li>
          <li>Add a note under <b>Notes &amp; history</b> so other leaders know how it went.</li>
          <li><b>Overdue:</b> a guest not texted within a day of their card gets an amber <b>Overdue</b> tag; after two days it turns red. Home shows how many are overdue at the top. Tap it to jump to them.</li>
        </ol>
        <p className="profile-hint help-after">No phone number on file? Reach them another way, then tap <b>Mark as contacted</b>.</p>
      </section>

      <section className="home-section">
        <div className="home-section-head"><h2>Notes and @mentions</h2></div>
        <MentionShot />
        <ul className="help-card help-list">
          <li><b>Notes</b> live on the guest in Planning Center (under Young Adults), so every YA leader and staff member with access sees them. Keep them kind and factual.</li>
          <li>Type <b>@</b> to mention a leader (<b>@Vinny Diaz</b>) or a whole crew (<b>@College Life</b>). Each person gets a <b>YA Mention</b> text with your note and a link to the guest. You won't get a text for your own note.</li>
          <li>Use it to hand off ("@Chris can you take this one?"), ask for help, or loop in a crew.</li>
          <li><b>Quiet hours:</b> mentions written between 9pm and 8am are held and sent at 8am. Need it now? Tick <b>Send now</b> under the note before posting.</li>
        </ul>
      </section>

      <section className="home-section">
        <div className="home-section-head"><h2>Reading the Home page</h2></div>
        <HomeShot />
        <div className="help-card help-rows">
          {HOME_ROWS.map(([name, means, todo]) => (
            <div className="help-row" key={name}>
              <div className="help-row-name">{name}</div>
              <div className="help-row-text">{means}</div>
              <div className="help-row-todo">{todo}</div>
            </div>
          ))}
        </div>
        <p className="profile-hint help-after">Tap a tile to jump to its list. Pull down on any list to refresh.</p>
      </section>

      <section className="home-section">
        <div className="home-section-head"><h2>Texts you'll get</h2></div>
        <SmsShot />
        <div className="help-card help-rows">
          <div className="help-row">
            <div className="help-row-name">YA New Guest</div>
            <div className="help-row-text">Someone in your crew filled out a connection card.</div>
            <div className="help-row-todo">Tap the link and claim them</div>
          </div>
          <div className="help-row">
            <div className="help-row-name">YA Mention</div>
            <div className="help-row-text">Another leader @mentioned you, or your crew, in a note.</div>
            <div className="help-row-todo">Tap the link to read it and reply with a note</div>
          </div>
          <div className="help-row">
            <div className="help-row-name">YA Follow-Up</div>
            <div className="help-row-text">9am daily, if a guest in your crew is still unclaimed, or you claimed someone and haven't marked them texted.</div>
            <div className="help-row-todo">Follow up, then mark it here</div>
          </div>
        </div>
        <p className="profile-hint help-after">
          Crews go by age: 18–22 College Life, 23–27 Early Career, 28+ Young Professional.
          Guests under 18 or with no birthday go to an admin.
        </p>
      </section>

      <section className="home-section">
        <div className="home-section-head"><h2>YA Status and Crew</h2></div>
        <div className="help-card help-rows">
          {STATUS_ROWS.map(([name, means]) => (
            <div className="help-row help-row-2" key={name}>
              <div className="help-row-name">{name}</div>
              <div className="help-row-text">{means}</div>
            </div>
          ))}
        </div>
        <p className="profile-hint help-after">
          Change either one on a guest's page; it saves straight to Planning Center. A guest's <b>Crew</b> decides which
          leaders get texted about them, so fix it if it's wrong.
        </p>
      </section>

      <section className="home-section">
        <div className="home-section-head"><h2>Good to know</h2></div>
        <ul className="help-card help-list">
          <li><b>Put it on your home screen:</b> in Safari, tap <Share size={13} /> Share, then <b>Add to Home Screen</b>. It opens like an app and stays signed in for 30 days.</li>
          <li><b>Your profile</b> (your initials, top right): add a photo and nickname, pick your crew (Home and People focus on it), and edit the text message you send guests.</li>
          <li><b>People tab:</b> the full YA list, with search and filters. Archived people are hidden unless you filter for them.</li>
          <li><b>Copy Link</b> on a guest's page gives you a link to send another leader.</li>
          <li><b>What gets saved when you text?</b> Only that you texted and when. Your message itself stays on your phone.</li>
          <li><b>Pull down</b> on Home or People to refresh.</li>
          <li><b>Can't sign in?</b> Use the exact email on your Planning Center profile, and check spam for the code. Only people marked <b>Leader</b> can sign in.</li>
        </ul>
      </section>

      {isAdmin && (
        <section className="home-section">
          <div className="home-section-head"><h2>For admins</h2></div>
          <ul className="help-card help-list">
            <li><b>Assign or reassign</b> a guest to any leader from the Admin box on their page. It counts as that leader's claim.</li>
            <li><b>Release</b> another leader's claim, or <b>Remove from follow-up</b> for someone who shouldn't be in it (their profile and notes stay).</li>
            <li><b>Leader status</b> gives someone access to this app, so only admins can set or remove it.</li>
          </ul>
        </section>
      )}
    </div>
  )
}
