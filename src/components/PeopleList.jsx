import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, TriangleAlert } from 'lucide-react'
import PersonRow from './PersonRow.jsx'
import { CREW_OPTIONS, CREW_LABEL } from './listMeta.js'

const LIST_OPTIONS = CREW_OPTIONS

export default function PeopleList({
  people, loading, error, statusOptions = [],
  myCrew = 'all', preset = null, cardsByPerson = {}, selectedId, onSelect, currentUser,
}) {
  const hasCrew = myCrew && myCrew !== 'all'

  const [list, setList]         = useState(() => myCrew || 'all')
  const [gender, setGender]     = useState('all')
  const [cardF, setCardF]       = useState('all')   // connection-card filter
  const [status, setStatus]     = useState('all')
  const [search, setSearch]     = useState('')
  const [sort, setSort]         = useState('name')

  // When the leader changes their crew on the Profile tab, focus the list on it.
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    setList(myCrew || 'all')
  }, [myCrew])

  // A filter handed over from Home (or a ?followup=… link). Each new preset
  // replaces the current filters; crew defaults to the leader's crew.
  useEffect(() => {
    if (!preset) return
    const cf = ['any', 'waiting', 'claimed', 'contacted'].includes(preset.card) ? preset.card : 'all'
    const crew = preset.crew && (preset.crew === 'all' || CREW_LABEL[preset.crew]) ? preset.crew : (myCrew || 'all')
    setList(crew); setCardF(cf); setStatus(preset.status || 'all'); setGender('all'); setSearch('')
  }, [preset]) // eslint-disable-line react-hooks/exhaustive-deps

  const myCrewStats = useMemo(() => {
    if (!hasCrew) return null
    const mine = people.filter(p => p.list === myCrew)
    return { total: mine.length, waiting: mine.filter(p => cardsByPerson[p.id]?.state === 'waiting').length }
  }, [people, myCrew, hasCrew, cardsByPerson])

  function focusMyCrew() {
    setList(myCrew); setGender('all'); setCardF('all'); setStatus('all'); setSearch('')
  }
  function focusFollowup() {
    setList(myCrew); setCardF('waiting'); setSearch('')
  }

  const counts = useMemo(() => ({
    all:         people.length,
    college:     people.filter(p => p.list === 'college').length,
    earlycareer: people.filter(p => p.list === 'earlycareer').length,
    youngpro:    people.filter(p => p.list === 'youngpro').length,
  }), [people])

  const visible = useMemo(() => {
    let rows = people.filter(p => {
      if (list !== 'all' && p.list !== list) return false
      if (gender !== 'all' && (p.gender || '').toLowerCase() !== gender) return false
      const c = cardsByPerson[p.id]
      if (cardF === 'any' && !c) return false
      if (['waiting', 'claimed', 'contacted'].includes(cardF) && c?.state !== cardF) return false
      if (status !== 'all' && p.status !== status) return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    if (sort === 'name')     rows = [...rows].sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'card') rows = [...rows].sort((a, b) =>
      (cardsByPerson[b.id]?.submittedAt || '').localeCompare(cardsByPerson[a.id]?.submittedAt || '') || a.name.localeCompare(b.name))
    return rows
  }, [people, list, gender, cardF, status, search, sort, cardsByPerson])

  return (
    <div className="people-pane">
      <header className="section-head section-head-list">
        <h1 className="section-title">Directory</h1>
        <span className="section-sub">{people.length} people in Planning Center</span>
      </header>
      {hasCrew && myCrewStats && (
        <div className="mycrew-banner">
          <div>
            <span className="mycrew-label">Your crew:</span>
            <strong>{CREW_LABEL[myCrew]}</strong> · {myCrewStats.total} people
          </div>
          <div className="mycrew-actions">
            <button onClick={focusMyCrew}>View my crew</button>
            {myCrewStats.waiting > 0 && (
              <button className="mycrew-followup" onClick={focusFollowup}>
                <TriangleAlert size={13} /> {myCrewStats.waiting} not claimed
              </button>
            )}
          </div>
        </div>
      )}

      <div className="list-toolbar">
        <div className="search-wrap">
          <Search className="search-icon" size={15} />
          <input
            className="search-input"
            type="search"
            placeholder="Search by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-row">
          <select className="filter-select" value={list} onChange={e => setList(e.target.value)}>
            {LIST_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label} ({counts[o.key]})</option>
            ))}
          </select>
          <select className="filter-select" value={gender} onChange={e => setGender(e.target.value)}>
            <option value="all">All genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          <select className="filter-select" value={cardF} onChange={e => setCardF(e.target.value)}>
            <option value="all">Any card status</option>
            <option value="any">Has a connection card</option>
            <option value="waiting">Card · not claimed</option>
            <option value="claimed">Card · claimed, not texted</option>
            <option value="contacted">Card · texted</option>
          </select>
          {statusOptions.length > 0 && (
            <select className="filter-select" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="all">Any status</option>
              {statusOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="list-meta">
        <span><strong>{visible.length}</strong> people</span>
        <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="name">Sort: Name</option>
          <option value="card">Sort: Newest connection card</option>
        </select>
      </div>

      <div className="people-list">
        {loading && <div className="empty-state">Loading people from PCO…</div>}
        {error   && <div className="empty-state" style={{ color: 'var(--danger)' }}>{error}</div>}
        {!loading && !error && visible.length === 0 && (
          <div className="empty-state"><Search size={28} /><p>No people match your filters.</p></div>
        )}
        {visible.map(p => (
          <PersonRow
            key={p.id}
            person={p}
            card={cardsByPerson[p.id] || null}
            selected={p.id === selectedId}
            onClick={() => onSelect(p.id)}
            currentUser={currentUser}
          />
        ))}
      </div>
    </div>
  )
}
