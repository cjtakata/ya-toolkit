import { useState, useEffect } from 'react'
import LoginScreen from './components/LoginScreen.jsx'
import AppHeader from './components/AppHeader.jsx'
import PeopleList from './components/PeopleList.jsx'
import DetailPanel from './components/DetailPanel.jsx'

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

function parseHashId() {
  const m = window.location.hash.match(/^#\/person\/(.+)$/)
  return m ? m[1] : null
}

function AuthenticatedApp({ user, onLogout }) {
  const [people, setPeople]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [selectedId, setSelectedId]   = useState(parseHashId)
  const [crewOptions, setCrewOptions]     = useState([])
  const [statusOptions, setStatusOptions] = useState([])

  // "My crew" preference: a manual pick (saved per-device) wins; otherwise fall
  // back to the crew implied by the user's Discord role; otherwise All crews.
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

  // Keep the URL hash in sync with the selected person
  useEffect(() => {
    const newHash = selectedId ? `#/person/${selectedId}` : ''
    if (window.location.hash !== newHash) {
      history.pushState(null, '', newHash || window.location.pathname)
    }
  }, [selectedId])

  // Handle browser back/forward
  useEffect(() => {
    function onPop() { setSelectedId(parseHashId()) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

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
      <AppHeader
        user={user}
        onLogout={handleLogout}
        listCount={people.length}
        myCrew={myCrew}
        onChooseCrew={chooseCrew}
      />
      <div className="app-body">
        <PeopleList
          people={people}
          loading={loading}
          error={error}
          statusOptions={statusOptions}
          myCrew={myCrew}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <DetailPanel
          person={selectedPerson}
          crewOptions={crewOptions}
          statusOptions={statusOptions}
          onClose={() => setSelectedId(null)}
          onSave={handleSave}
        />
      </div>
    </div>
  )
}
