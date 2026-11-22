// "How the YA Toolkit works" — the leader guide, opened from Profile.
// Mirrors the shared YA Toolkit Leader Guide doc; keep the two in step.
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
          <li>Open the guest and tap <b>Claim</b>. The card turns purple: <b>Claimed by you</b>. Can't follow up after all? Tap <b>Release</b>.</li>
          <li>Tap <b>Text</b>. Messages opens with your saved message filled in. Tweak it and send.</li>
          <li>Back here, answer <b>Did you send the text?</b> with <b>Yes, I sent it</b>. The card turns green.</li>
          <li>Add a note under <b>Notes &amp; History</b> so other leaders know how it went.</li>
        </ol>
        <p className="profile-hint help-after">No phone number on file? Reach them another way, then tap <b>Mark as contacted</b>.</p>
      </section>

      <section className="home-section">
        <div className="home-section-head"><h2>Reading the Home page</h2></div>
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
