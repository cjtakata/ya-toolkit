import { useState, useMemo, useEffect } from 'react'
import PersonRow from './PersonRow.jsx'
import { CREW_OPTIONS, CREW_LABEL } from './listMeta.js'

const LIST_OPTIONS = CREW_OPTIONS

export default function PeopleList({
  people, loading, error, statusOptions = [],
  myCrew = 'all', selectedId, onSelect,
}) {
  const hasCrew = myCrew && myCrew !== 'all'

  const [list, setList]         = useState(() => myCrew || 'all')
  const [gender, setGender]     = useState('all')
  const [followup, setFollowup] = useState('all')
  const [status, setStatus]     = useState('all')
  const [search, setSearch]     = useState('')
  const [sort, setSort]         = useState('name')

  // When the leader changes their crew in the profile bar, focus the list on it.
  useEffect(() => { setList(myCrew || 'all') }, [myCrew])

  const myCrewStats = useMemo(() => {
    if (!hasCrew) return null
    const mine = people.filter(p => p.list === myCrew)
    return { total: mine.length, needs: mine.filter(p => p.needsFollowup).length }
  }, [people, myCrew, hasCrew])

  function focusMyCrew() {
    setList(myCrew); setGender('all'); setFollowup('all'); setStatus('all'); setSearch('')
  }
  function focusFollowup() {
    setList(myCrew); setFollowup('needs'); setSearch('')
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
      if (followup === 'needs' && !p.needsFollowup) return false
      if (followup === 'none'  &&  p.needsFollowup) return false
      if (status !== 'all' && p.status !== status) return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    if (sort === 'name')     rows = [...rows].sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'followup') rows = [...rows].sort((a, b) => {
      if (a.needsFollowup === b.needsFollowup) return a.name.localeCompare(b.name)
      return a.needsFollowup ? -1 : 1
    })
    return rows
  }, [people, list, gender, followup, status, search, sort])

  return (
    <div className="people-pane">
      {hasCrew && myCrewStats && (
        <div className="mycrew-banner">
          <div>
            <span className="mycrew-label">Your crew:</span>
            <strong>{CREW_LABEL[myCrew]}</strong> · {myCrewStats.total} people
          </div>
          <div className="mycrew-actions">
            <button onClick={focusMyCrew}>View my crew</button>
            {myCrewStats.needs > 0 && (
              <button className="mycrew-followup" onClick={focusFollowup}>
                ⚠ {myCrewStats.needs} need follow-up
              </button>
            )}
          </div>
        </div>
      )}

      <div className="list-toolbar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
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
          <select className="filter-select" value={followup} onChange={e => setFollowup(e.target.value)}>
            <option value="all">Any follow-up</option>
            <option value="needs">Needs follow-up</option>
            <option value="none">No follow-up</option>
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
          <option value="followup">Sort: Needs follow-up first</option>
        </select>
      </div>

      <div className="people-list">
        {loading && <div className="empty-state">Loading people from PCO…</div>}
        {error   && <div className="empty-state" style={{ color: 'var(--danger)' }}>{error}</div>}
        {!loading && !error && visible.length === 0 && (
          <div className="empty-state">🔍<p>No people match your filters.</p></div>
        )}
        {visible.map(p => (
          <PersonRow
            key={p.id}
            person={p}
            selected={p.id === selectedId}
            onClick={() => onSelect(p.id)}
          />
        ))}
      </div>
    </div>
  )
}
