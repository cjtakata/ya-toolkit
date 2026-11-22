import { useState, useEffect, useMemo } from 'react'
import LoginScreen from './components/LoginScreen.jsx'
import PeopleList from './components/PeopleList.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import TabBar from './components/TabBar.jsx'
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

  return <AuthenticatedApp user={user} onLogout={() => setUser(null)} />
}

// URL hash routes: #/home · #/search · #/profile · #/person/<id> (opens over the current tab)
const TABS = ['home', 'search', 'profile']
function parseHashId() {
  const m = window.location.hash.match(/^#\/person\/(.+)$/)
  return m ? m[1] : null
}
function parseHashTab() {
  const m = window.location.hash.match(/^#\/(home|search|profile)$/)
  return m ? m[1] : null
}

// Filter links like /people?followup=unclaimed&crew=college open the Search tab pre-filtered.
function readUrlPreset() {
  const q = new URLSearchParams(window.location.search)
  const followup = q.get('followup'), crew = q.get('crew'), status = q.get('status')
  if (!followup && !crew && !status) return null
  return { followup, crew, status, n: 0 }
}

function AuthenticatedApp({ user, onLogout }) {
  const [people, setPeople]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [selectedId, setSelectedId]   = useState(parseHashId)
  const [crewOptions, setCrewOptions]     = useState([])
  const [statusOptions, setStatusOptions] = useState([])
  const [preset, setPreset]           = useState(readUrlPreset)
  const [tab, setTab]                 = useState(() => parseHashTab() || (readUrlPreset() ? 'search' : 'home'))
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
    const newHash = selectedId ? `#/person/${selectedId}` : `#/${tab}`
    if (window.location.hash === newHash && !window.location.search) return
    const url = window.location.pathname + newHash
    if (selectedId && parseHashId() !== selectedId) history.pushState(null, '', url)
    else history.replaceState(null, '', url)
  }, [selectedId, tab])

  // Handle browser back/forward
  useEffect(() => {
    function onPop() {
      setSelectedId(parseHashId())
      const t = parseHashTab()
      if (t) setTab(t)
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

  const unclaimedCount = useMemo(() => {
    const scoped = myCrew && myCrew !== 'all' ? people.filter(p => p.list === myCrew) : people
    return scoped.filter(p => p.needsFollowup && !(p.assignedLeader || '').trim()).length
  }, [people, myCrew])

  const selectedPerson = people.find(p => p.id === selectedId) ?? null

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
    return updated
  }

  async function handleLogout() {
    await fetch('/api/auth/logout')
    onLogout()
  }

  if (loading) return <LoadingScreen label={loadLabel} progress={loadProgress} />

  return (
    <div className="app-screen">
      <div className="app-body">
        <div className={`tab-view${tab === 'home' ? '' : ' tab-hidden'}`}>
          <HomeTab
            people={people}
            myCrew={myCrew}
            currentUser={currentUser}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onSeeAll={openSearch}
            onChangeCrew={() => changeTab('profile')}
          />
        </div>
        {/* Search stays mounted so filters survive switching tabs */}
        <div className={`tab-view${tab === 'search' ? '' : ' tab-hidden'}`}>
          <PeopleList
            people={people}
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
        <div className={`tab-view${tab === 'profile' ? '' : ' tab-hidden'}`}>
          <ProfileTab user={user} myCrew={myCrew} onChooseCrew={chooseCrew} onLogout={handleLogout} />
        </div>
        <DetailPanel
          person={selectedPerson}
          crewOptions={crewOptions}
          statusOptions={statusOptions}
          currentUser={currentUser}
          onClose={() => setSelectedId(null)}
          onSave={handleSave}
        />
      </div>
      <TabBar tab={tab} onChange={changeTab} user={user} badge={unclaimedCount} />
    </div>
  )
}
