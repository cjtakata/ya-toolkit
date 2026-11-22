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
      <div className="fu-log fu-log-mine fu-text-btn help-fake-btn"><MessageCircle size={16} /> Text {G}</div>
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
      <div className="stat"><Clock size={18} /><span className="stat-num">3</span><span className="stat-label">Claimed, not texted</span></div>
      <div className="stat stat-green"><MessageCircleHeart size={18} /><span className="stat-num">5</span><span className="stat-label">Texted · 30 days</span></div>
    </div>
  </Shot>
)
const SmsShot = () => (
  <Shot caption="What a new-guest text looks like">
    <div className="help-sms">
      <div className="help-sms-from">Venture YA</div>
      <div className="help-sms-bubble">YA New Guest: Jordan Rivera (College Life) filled out a card. Claim &amp; text them: ya-toolkit.vercel.app/p/…</div>
    </div>
  </Shot>
)
const HOME_ROWS = [
  ['Not claimed', 'New connection cards no leader has taken yet', 'Claim the ones in your crew'],
  ['Yours to text', "Guests you claimed but haven't marked as texted", 'Text them, then confirm in the app'],
  ['Claimed, not texted', "Guests other leaders claimed and haven't texted yet", "Nothing, unless they've waited a while"],
  ['Texted · 30 days', 'Guests a leader contacted in the last 30 days', 'Nothing. This is the win column'],
]

export default function HelpGuide() {
  return (
    <div className="help-guide">
      <p className="help-lead">
        When a young adult fills out a connection card, a leader from their crew claims them here,
        texts them, and marks it done, ideally within a day.
      </p>

      <section className="home-section">
        <div className="home-section-head"><h2>Following up with a new guest</h2></div>
        <ol className="help-card help-steps">
          <li>A guest fills out a connection card. They show up under <b>Not claimed</b>, and their crew's leaders get a text with a link.</li>
          <li>Open the guest and tap <b>Claim</b>. The card turns purple: <b>Claimed by you</b>. Can't follow up after all? Tap <b>Release</b>.<ClaimShot /></li>
          <li>Tap <b>Text</b>. Messages opens with your saved message filled in. Tweak it and send.<TextShot /></li>
          <li>Back here, answer <b>Did you send the text?</b> with <b>Yes, I sent it</b>. The card turns green.<ConfirmShot /></li>
          <li>Add a note under <b>Notes &amp; History</b> so other leaders know how it went.</li>
        </ol>
        <p className="profile-hint help-after">No phone number on file? Reach them another way, then tap <b>Mark as contacted</b>.</p>
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
        <div className="home-section-head"><h2>Good to know</h2></div>
        <ul className="help-card help-list">
          <li><b>Your profile:</b> add a photo and nickname, pick your crew (Home and People focus on it), and edit the text message you send guests.</li>
          <li><b>A guest's page:</b> change their YA Status or Crew there; it saves to Planning Center. <b>Copy Link</b> shares them with another leader.</li>
          <li><b>People tab:</b> the full YA list, with search and filters.</li>
          <li><b>Can't sign in?</b> Use the exact email on your Planning Center profile, and check spam for the code.</li>
        </ul>
      </section>
    </div>
  )
}
