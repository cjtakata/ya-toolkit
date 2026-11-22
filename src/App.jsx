import { useState, useEffect, useMemo, useCallback } from 'react'
import LoginScreen from './components/LoginScreen.jsx'
import PeopleList from './components/PeopleList.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import AppTopBar from './components/AppTopBar.jsx'
import Sheet from './components/Sheet.jsx'
import { CREW_LABEL } from './components/listMeta.js'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}
import HomeTab from './components/HomeTab.jsx'
import ProfileTab from './components/ProfileTab.jsx'

function LoadingScreen({ label, progress }) {
  return (
    <div className="loading-screen">
      <div className="loading-logo">
        <img src="/ya.svg" alt="YA People" />
      </div>
      <div className="loading-bar-track">
        <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="loading-label">{label}</div>
    </div>
  )
}

export default function App() {
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

// URL hash routes: #/home · #/search · #/profile (Profile sheet over Home) · #/person/<id> (over the current tab)
const TABS = ['home', 'search']
function parseHashId() {
  const m = window.location.hash.match(/^#\/person\/(.+)$/)
  return m ? m[1] : null
}
function parseHashTab() {
  const m = window.location.hash.match(/^#\/(home|search|profile)$/)
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
    return t && t !== 'profile' ? t : (readUrlPreset() ? 'search' : 'home')
  })
  const [profileOpen, setProfileOpen] = useState(() => parseHashTab() === 'profile')
  const currentUser = user.global_name || user.username || 'Leader'

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

  async function handleCardAction(card, action) {
    setBusyCard(card.cardId)
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: card.cardId, action }),
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
    const newHash = selectedId ? `#/person/${selectedId}` : profileOpen ? '#/profile' : `#/${tab}`
    if (window.location.hash === newHash && !window.location.search) return
    const url = window.location.pathname + newHash
    if (selectedId && parseHashId() !== selectedId) history.pushState(null, '', url)
    else history.replaceState(null, '', url)
  }, [selectedId, tab, profileOpen])

  // Handle browser back/forward
  useEffect(() => {
    function onPop() {
      setSelectedId(parseHashId())
      const t = parseHashTab()
      setProfileOpen(t === 'profile')
      if (t && t !== 'profile') setTab(t)
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
  const cardsByPerson = useMemo(() => Object.fromEntries(cards.map(c => [c.personId, c])), [cards])
  const allPeople = useMemo(() => {
    const ids = new Set(people.map(p => p.id))
    const extra = cards.filter(c => !ids.has(c.personId)).map(c => c.person)
    return extra.length ? [...people, ...extra].sort((a, b) => a.name.localeCompare(b.name)) : people
  }, [people, cards])

  const waitingCount = useMemo(() => cards.filter(c =>
    c.state === 'waiting' && (!myCrew || myCrew === 'all' || c.person.list === myCrew)).length, [cards, myCrew])

  const selectedPerson = allPeople.find(p => p.id === selectedId) ?? null

  async function handleSave(id, body) {
    const res = await fetch(`/api/person/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      let detail = ''
      try { detail = (await res.json()).detail || '' } catch { /* ignore */ }
      throw new Error(detail || `Save failed (HTTP ${res.status})`)
    }
    const updated = await res.json()
    setPeople(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p))
    setCards(prev => prev.map(c => c.personId === id ? { ...c, person: { ...c.person, ...updated } } : c))
    return updated
  }

  async function saveTextMessage(textMessage) {
    const res = await fetch('/api/me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ textMessage }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `Couldn't save (HTTP ${res.status})`)
    onUserChange({ textMessage: data.textMessage })
  }

  async function handleLogout() {
    await fetch('/api/auth/logout')
    onLogout()
  }

  if (loading) return <LoadingScreen label={loadLabel} progress={loadProgress} />

  return (
    <div className="app-screen">
      <AppTopBar
        tab={tab} onChange={changeTab} user={user} badge={waitingCount}
        title={tab === 'home' ? `${greeting()}, ${currentUser.split(' ')[0]}` : 'People'}
        subtitle={tab === 'search'
          ? `${allPeople.length} people in Planning Center`
          : `${myCrew && myCrew !== 'all' ? CREW_LABEL[myCrew] : 'All crews'} · ${myCrew && myCrew !== 'all' ? people.filter(p => p.list === myCrew).length : people.length} people`}
        onSubtitleClick={tab === 'home' ? () => setProfileOpen(true) : null}
        onOpenProfile={() => setProfileOpen(true)}
      />
      <div className="app-body">
        <div className={`tab-view${tab === 'home' ? '' : ' tab-hidden'}`}>
          <HomeTab
            cards={cards}
            cardsLoading={cardsLoading}
            cardsError={cardsError}
            onRefresh={() => loadCards(true)}
            onClaim={claimFromList}
            busyCard={busyCard}
            people={people}
            myCrew={myCrew}
            currentUser={currentUser}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onSeeAll={openSearch}
            onChangeCrew={() => setProfileOpen(true)}
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
          />
        </div>
        <DetailPanel
          person={selectedPerson}
          crewOptions={crewOptions}
          statusOptions={statusOptions}
          currentUser={currentUser}
          textTemplate={user.textMessage || ''}
          card={selectedPerson ? cardsByPerson[selectedPerson.id] || null : null}
          onCardAction={handleCardAction}
          backLabel={tab === 'home' ? 'Home' : 'People'}
          onClose={() => setSelectedId(null)}
          onSave={handleSave}
        />
      </div>
      <Sheet open={profileOpen} title="Profile" onClose={() => setProfileOpen(false)}>
        <ProfileTab user={user} myCrew={myCrew} onChooseCrew={chooseCrew} onLogout={handleLogout}
          onSaveMessage={saveTextMessage} />
      </Sheet>
    </div>
  )
}
