import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import LoginScreen from './components/LoginScreen.jsx'
import PeopleList from './components/PeopleList.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import AppTopBar from './components/AppTopBar.jsx'
import Sheet from './components/Sheet.jsx'
import { LIST_META } from './components/listMeta.js'

import HomeTab, { inCrew } from './components/HomeTab.jsx'
import ProfileTab from './components/ProfileTab.jsx'
import HelpGuide from './components/HelpGuide.jsx'
import TeamStats from './components/TeamStats.jsx'
import CrewCoverage from './components/CrewCoverage.jsx'
import { MINISTRY } from '../ministry.config.js'
import { Eye } from 'lucide-react'
import InstallPage from './components/InstallPage.jsx'
import { INSTALL_PATH, isStandalone } from './components/install.js'
import { badgeCount } from './components/badgeCount.js'
import { setIconBadge, syncDeviceCrew } from './components/pushClient.js'

function LoadingScreen({ label, progress }) {
  return (
    <div className="loading-screen">
      <div className="loading-logo">
        <img src="/ya.svg" alt="YA Toolkit" />
      </div>
      <div className="loading-bar-track">
        <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="loading-label">{label}</div>
    </div>
  )
}

export default function App() {
  // /install: the shareable "add to your home screen" page, no sign-in needed.
  // Opened from the home screen itself, it just goes into the app.
  if (window.location.pathname === INSTALL_PATH) {
    if (!isStandalone()) return <InstallPage />
    window.history.replaceState(null, '', '/people')
  }
  return <SignedInGate />
}

function SignedInGate() {
  const [user, setUser]           = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { setUser(data); setAuthLoading(false) })
      .catch(() => setAuthLoading(false))
  }, [])

  if (authLoading) return <LoadingScreen label="Checking authentication…" progress={20} />
  if (!user) return <LoginScreen />

  return <AuthenticatedApp user={user} onUserChange={u => setUser(prev => ({ ...prev, ...u }))} onLogout={() => setUser(null)} />
}

// URL hash routes: #/home · #/search · #/profile (Profile sheet over Home) · #/help (the guide)
// · #/person/<id> (over the current tab). /help redirects to #/help (vercel.json).
const TABS = ['home', 'search']
function parseHashId() {
  const m = window.location.hash.match(/^#\/person\/(.+)$/)
  return m ? m[1] : null
}
function parseHashTab() {
  const m = window.location.hash.match(/^#\/(home|search|profile|help|team|crews)$/)
  return m ? m[1] : null
}

// Filter links like /people?card=waiting&crew=college open the Search tab pre-filtered.
function readUrlPreset() {
  const q = new URLSearchParams(window.location.search)
  const card = q.get('card'), crew = q.get('crew'), status = q.get('status')
  if (!card && !crew && !status) return null
  return { card, crew, status, n: 0 }
}

function AuthenticatedApp({ user, onUserChange, onLogout }) {
  const [people, setPeople]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [selectedId, setSelectedId]   = useState(parseHashId)
  const [crewOptions, setCrewOptions]     = useState([])
  const [statusOptions, setStatusOptions] = useState([])
  const [preset, setPreset]           = useState(readUrlPreset)
  const [tab, setTab]                 = useState(() => {
    const t = parseHashTab()
    return TABS.includes(t) ? t : (readUrlPreset() ? 'search' : 'home')   // #/profile, #/help, #/team and #/crews open over Home
  })
  const [profileOpen, setProfileOpen] = useState(() => parseHashTab() === 'profile')
  const [helpOpen, setHelpOpen]       = useState(() => parseHashTab() === 'help')
  const [teamOpen, setTeamOpen]       = useState(() => parseHashTab() === 'team')
  const [crewsOpen, setCrewsOpen]     = useState(() => parseHashTab() === 'crews')
  const currentUser = user.global_name || user.username || 'Leader'

  // The page itself never scrolls while signed in (see html.app-shell in index.css)
  useEffect(() => {
    document.documentElement.classList.add('app-shell')
    return () => document.documentElement.classList.remove('app-shell')
  }, [])

  // "My crew" preference: a manual pick (saved per-device) wins; otherwise fall
  // back to the crew from the leader's PCO Crew field; otherwise All crews.
  const [myCrew, setMyCrew] = useState(() => {
    const saved = localStorage.getItem('ya_my_crew')
    if (saved) return saved
    const roleCrew = (user.crews || []).filter(c => c !== '*')
    return roleCrew.length === 1 ? roleCrew[0] : 'all'
  })

  function chooseCrew(key) {
    setMyCrew(key)
    localStorage.setItem('ya_my_crew', key)
  }

  // Connection-card follow-ups (PCO workflow cards) — see api/cards.js
  const [cards, setCards]               = useState([])
  const [cardsLoading, setCardsLoading] = useState(true)
  const [cardsError, setCardsError]     = useState(false)
  const [busyCard, setBusyCard]         = useState(null)

  const loadCards = useCallback((fresh = false) => {
    setCardsLoading(true)
    return fetch('/api/cards' + (fresh ? '?fresh=1' : ''))
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setCards(Array.isArray(data) ? data : []); setCardsError(false) })
      .catch(() => setCardsError(true))
      .finally(() => setCardsLoading(false))
  }, [])

  useEffect(() => {
    loadCards()
    // Pick up claims from other leaders when the app comes back to the foreground
    function onVisible() { if (document.visibilityState === 'visible') loadCards() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loadCards])

  // extra: { leaderId } for an admin's 'assign'
  async function handleCardAction(card, action, extra = {}) {
    setBusyCard(card.cardId)
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...extra, cardId: card.cardId, action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Something went wrong (HTTP ${res.status})`)
    } finally {
      await loadCards(true)   // refresh even on a conflict, so the screen shows who has them
      setBusyCard(null)
    }
  }
  function claimFromList(card) {
    handleCardAction(card, 'claim').catch(err => alert(err.message))
  }

  // Drag-down-to-refresh: re-pull cards and people without the loading screen
  // report(0–1) drives the pull-to-refresh progress bar as each request finishes.
  const refreshAll = useCallback(async (report = () => {}) => {
    let done = 0
    const step = () => report(0.1 + (++done / 2) * 0.9)
    report(0.1)
    const results = await Promise.allSettled([
      loadCards(true).finally(step),
      fetch('/api/people?fresh=1').then(r => r.ok ? r.json() : Promise.reject(new Error('people')))
        .then(data => { if (Array.isArray(data)) setPeople(data) })
        .finally(step),
    ])
    if (results.some(r => r.status === 'rejected')) throw new Error("Couldn't refresh")
  }, [loadCards])

  const [loadProgress, setLoadProgress] = useState(30)
  const [loadLabel, setLoadLabel]       = useState('Loading people…')

  useEffect(() => {
    // Animate to 60% while waiting for the people fetch
    const t = setTimeout(() => setLoadProgress(60), 400)

    fetch('/api/people')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setPeople(data)
        setLoadProgress(100)
        setTimeout(() => setLoading(false), 300)
      })
      .catch(() => { setError('Failed to load people from PCO.'); setLoading(false) })

    fetch('/api/meta')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.crewOptions)   setCrewOptions(data.crewOptions)
        if (data?.statusOptions) setStatusOptions(data.statusOptions)
        setLoadLabel('Almost ready…')
        setLoadProgress(prev => Math.max(prev, 80))
      })
      .catch(() => {})

    return () => clearTimeout(t)
  }, [])

  // Keep the URL hash in sync: opening a person pushes history (so Back closes
  // it); switching tabs just replaces the hash. Query-string filters are dropped
  // once applied so a reload doesn't re-apply them.
  useEffect(() => {
    const newHash = selectedId ? `#/person/${selectedId}` : helpOpen ? '#/help' : teamOpen ? '#/team' : crewsOpen ? '#/crews' : profileOpen ? '#/profile' : `#/${tab}`
    if (window.location.hash === newHash && !window.location.search) return
    const url = window.location.pathname + newHash
    if (selectedId && parseHashId() !== selectedId) history.pushState(null, '', url)
    else history.replaceState(null, '', url)
  }, [selectedId, tab, profileOpen, helpOpen, teamOpen, crewsOpen])

  // Handle browser back/forward
  useEffect(() => {
    function onPop() {
      setSelectedId(parseHashId())
      const t = parseHashTab()
      setProfileOpen(t === 'profile')
      setHelpOpen(t === 'help')
      setTeamOpen(t === 'team')
      setCrewsOpen(t === 'crews')
      if (TABS.includes(t)) setTab(t)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function changeTab(t) {
    if (!TABS.includes(t)) return
    setSelectedId(null)
    setTab(t)
  }

  // From Home: jump to Search with a filter applied
  function openSearch(filter) {
    setPreset(prev => ({ ...filter, n: (prev?.n || 0) + 1 }))
    changeTab('search')
  }

  // Card guests may not have a YA Status that puts them on the People list yet —
  // fold them in so they're searchable and their profile opens.
  // One card per person: their CURRENT card. Someone who re-enters the workflow
  // gets a new card, so an open card (waiting/claimed) wins over a completed
  // one; otherwise the newest. Older cards show up in the profile's history feed.
  const currentCards = useMemo(() => {
    const best = {}
    const rank = c => (c.state === 'contacted' ? 0 : 1)
    for (const c of cards) {
      const b = best[c.personId]
      if (!b || rank(c) > rank(b) || (rank(c) === rank(b) && (c.submittedAt || '') > (b.submittedAt || ''))) best[c.personId] = c
    }
    return Object.values(best)
  }, [cards])
  const cardsByPerson = useMemo(() => Object.fromEntries(currentCards.map(c => [c.personId, c])), [currentCards])
  const allPeople = useMemo(() => {
    const ids = new Set(people.map(p => p.id))
    const extra = currentCards.filter(c => !ids.has(c.personId)).map(c => c.person)
    return extra.length ? [...people, ...extra].sort((a, b) => a.name.localeCompare(b.name)) : people
  }, [people, currentCards])

  const waitingCount = useMemo(() => currentCards.filter(c =>
    c.state === 'waiting' && inCrew(c, myCrew)).length, [currentCards, myCrew])

  // App-icon badge: guests waiting on me (same rule the server uses in pushes).
  useEffect(() => {
    if (cardsLoading || cardsError) return
    setIconBadge(badgeCount(currentCards, { crew: myCrew, me: currentUser }))
  }, [currentCards, myCrew, currentUser, cardsLoading, cardsError])
  // Keep this device's crew (for badges sent with pushes) in step with the picker.
  const firstCrew = useRef(true)
  useEffect(() => {
    if (firstCrew.current) { firstCrew.current = false; return }
    syncDeviceCrew(myCrew)
  }, [myCrew])

  const selectedPerson = allPeople.find(p => p.id === selectedId) ?? null
  // YA Leaders: anyone can @mention them in notes; admins also assign guests to them
  const leaders = useMemo(
    () => people.filter(p => p.status === MINISTRY.statuses.leader).map(p => ({ id: p.id, name: p.name, crewLabel: LIST_META[p.list]?.crew })),
    [people],
  )

  // Phones show a person in a slide-up sheet; wider screens use the side panel.
  const [isPhone, setIsPhone] = useState(() => window.matchMedia('(max-width: 700px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)')
    const on = () => setIsPhone(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  // Keep showing the last person while the sheet slides away
  const lastPersonRef = useRef(null)
  if (selectedPerson) lastPersonRef.current = selectedPerson
  const sheetPerson = selectedPerson || lastPersonRef.current

  async function handleSave(id, body) {
    const res = await fetch(`/api/person/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const updated = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(updated.error || `Save failed (HTTP ${res.status})`)
    setPeople(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p))
    setCards(prev => prev.map(c => c.personId === id ? { ...c, person: { ...c.person, ...updated } } : c))
    return updated
  }

  // Nickname, photo or text message → the leader's own PCO profile (see api/me.js)
  async function saveProfile(change) {
    const res = await fetch('/api/me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(change),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `Couldn't save (HTTP ${res.status})`)
    if ('nickname' in change)    onUserChange({ nickname: data.nickname })
    if ('photo' in change)       onUserChange({ avatar: data.avatar })
    if ('textMessage' in change) onUserChange({ textMessage: data.textMessage })
  }

  async function handleLogout() {
    await fetch('/api/auth/logout')
    onLogout()
  }

  if (loading) return <LoadingScreen label={loadLabel} progress={loadProgress} />

  const detailProps = person => ({
    person,
    crewOptions, statusOptions, currentUser, leaders,
    textTemplate: user.textMessage || '',
    leaderFirst:  user.nickname || currentUser.split(' ')[0],
    card:         person ? cardsByPerson[person.id] || null : null,
    onCardAction: handleCardAction,
    isAdmin:      !!user.isAdmin,
    readOnly:     !!user.viewOnly,
    backLabel:    tab === 'home' ? 'Home' : 'People',
    onClose:      () => setSelectedId(null),
    onSave:       handleSave,
  })

  return (
    <div className="app-screen">
      <AppTopBar
        tab={tab} onChange={changeTab} user={user} badge={waitingCount}
        onOpenProfile={() => setProfileOpen(true)}
      />
      {user.viewOnly && (
        <div className="viewonly-bar" role="note"><Eye size={14} /> View-only access: you can look around, leave notes and @mention leaders, but other changes are turned off.</div>
      )}
      <div className="app-body">
        <div className={`tab-view${tab === 'home' ? '' : ' tab-hidden'}`}>
          <HomeTab
            greetName={user.nickname || currentUser.split(' ')[0]}
            cards={currentCards}
            cardsLoading={cardsLoading}
            cardsError={cardsError}
            onRefresh={() => loadCards(true)}
            onPullRefresh={refreshAll}
            onClaim={user.viewOnly ? null : claimFromList}
            busyCard={busyCard}
            myCrew={myCrew}
            currentUser={currentUser}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onSeeAll={openSearch}
          />
        </div>
        {/* Search stays mounted so filters survive switching tabs */}
        <div className={`tab-view${tab === 'search' ? '' : ' tab-hidden'}`}>
          <PeopleList
            people={allPeople}
            cardsByPerson={cardsByPerson}
            loading={loading}
            error={error}
            statusOptions={statusOptions}
            myCrew={myCrew}
            preset={preset}
            selectedId={selectedId}
            onSelect={setSelectedId}
            currentUser={currentUser}
            onPullRefresh={refreshAll}
          />
        </div>
        {!isPhone && <DetailPanel {...detailProps(selectedPerson)} />}
      </div>
      {isPhone && (
        <Sheet open={!!selectedPerson} tall onClose={() => setSelectedId(null)}>
          <DetailPanel variant="sheet" {...detailProps(sheetPerson)} />
        </Sheet>
      )}
      <Sheet open={profileOpen} title="Profile" showTitle={false} onClose={() => setProfileOpen(false)}>
        <ProfileTab onOpenHelp={() => { setProfileOpen(false); setHelpOpen(true) }}
          onOpenTeam={user.isAdmin ? () => { setProfileOpen(false); setTeamOpen(true) } : null}
          onOpenCrews={user.isAdmin ? () => { setProfileOpen(false); setCrewsOpen(true) } : null} user={user} myCrew={myCrew} onChooseCrew={chooseCrew} onLogout={handleLogout}
          onSaveMessage={textMessage => saveProfile({ textMessage })} onSaveProfile={saveProfile} />
      </Sheet>
      <Sheet open={helpOpen} title="How it works" tall onClose={() => setHelpOpen(false)}>
        <HelpGuide isAdmin={!!user.isAdmin} />
      </Sheet>
      {user.isAdmin && (
        <Sheet open={teamOpen} title="Leader reach-outs" tall onClose={() => setTeamOpen(false)}>
          {teamOpen && <TeamStats leaders={people.filter(p => p.status === MINISTRY.statuses.leader)}
            onOpenPerson={id => { setTeamOpen(false); setSelectedId(id) }} />}
        </Sheet>
      )}
      {user.isAdmin && (
        <Sheet open={crewsOpen} title="Crew leaders" tall onClose={() => setCrewsOpen(false)}>
          {crewsOpen && <CrewCoverage people={people} cards={currentCards} loading={loading} />}
        </Sheet>
      )}
    </div>
  )
}
