import usePullToRefresh from './usePullToRefresh.jsx'
import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, SlidersHorizontal, X, Check } from 'lucide-react'
import PersonRow from './PersonRow.jsx'
import Sheet from './Sheet.jsx'
import { CREW_OPTIONS, CREW_LABEL } from './listMeta.js'
import { MINISTRY } from '../../ministry.config.js'

const CARD_OPTIONS = [
  { key: 'all',       label: 'Any' },
  { key: 'any',       label: 'Has a card' },
  { key: 'waiting',   label: 'Not claimed' },
  { key: 'claimed',   label: 'Claimed, not texted' },
  { key: 'contacted', label: 'Texted' },
]
const GENDER_OPTIONS = [{ key: 'all', label: 'Any' }, { key: 'male', label: 'Male' }, { key: 'female', label: 'Female' }]
const SORT_OPTIONS   = [{ key: 'name', label: 'Name' }, { key: 'card', label: 'Newest connection card' }]

// Pill group used inside the filter sheet
function Choices({ label, options, value, onChange }) {
  return (
    <div className="fchoices">
      <div className="fchoices-label">{label}</div>
      <div className="fchoices-row">
        {options.map(o => (
          <button key={o.key} className={`fchip${value === o.key ? ' on' : ''}`} onClick={() => onChange(o.key)}>
            {value === o.key && <Check size={13} strokeWidth={3} />}{o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const LIST_OPTIONS = CREW_OPTIONS

export default function PeopleList({
  people, loading, error, statusOptions = [],
  myCrew = 'all', preset = null, cardsByPerson = {}, selectedId, onSelect, currentUser, onPullRefresh,
}) {
  const ptr = usePullToRefresh(onPullRefresh)
  const [list, setList]         = useState(() => myCrew || 'all')
  const [gender, setGender]     = useState('all')
  const [cardF, setCardF]       = useState('all')   // connection-card filter
  const [status, setStatus]     = useState('all')
  const [search, setSearch]     = useState('')
  const [sort, setSort]         = useState('name')
  const [filtersOpen, setFiltersOpen] = useState(false)

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

  // Archived people stay out of sight unless the YA Status filter asks for them
  const isArchived = p => p.status === MINISTRY.statuses.archived
  const current = useMemo(() => people.filter(p => !isArchived(p)), [people])
  const counts = useMemo(() => {
    const pool = status === MINISTRY.statuses.archived ? people.filter(isArchived) : current
    return {
      all:         pool.length,
      college:     pool.filter(p => p.list === 'college').length,
      earlycareer: pool.filter(p => p.list === 'earlycareer').length,
      youngpro:    pool.filter(p => p.list === 'youngpro').length,
    }
  }, [people, current, status])

  const visible = useMemo(() => {
    let rows = people.filter(p => {
      if (list !== 'all' && p.list !== list) return false
      if (gender !== 'all' && (p.gender || '').toLowerCase() !== gender) return false
      const c = cardsByPerson[p.id]
      if (cardF === 'any' && !c) return false
      if (['waiting', 'claimed', 'contacted'].includes(cardF) && c?.state !== cardF) return false
      if (status === 'all' && isArchived(p)) return false
      if (status !== 'all' && p.status !== status) return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    if (sort === 'name')     rows = [...rows].sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'card') rows = [...rows].sort((a, b) =>
      (cardsByPerson[b.id]?.submittedAt || '').localeCompare(cardsByPerson[a.id]?.submittedAt || '') || a.name.localeCompare(b.name))
    return rows
  }, [people, list, gender, cardF, status, search, sort, cardsByPerson])

  // Active filters (crew counts as active only when it differs from "All crews")
  const activeChips = [
    list !== 'all'    && { key: 'crew',   label: CREW_LABEL[list] || list, clear: () => setList('all') },
    cardF !== 'all'   && { key: 'card',   label: CARD_OPTIONS.find(o => o.key === cardF)?.label, clear: () => setCardF('all') },
    status !== 'all'  && { key: 'status', label: status, clear: () => setStatus('all') },
    gender !== 'all'  && { key: 'gender', label: GENDER_OPTIONS.find(o => o.key === gender)?.label, clear: () => setGender('all') },
    sort !== 'name'   && { key: 'sort',   label: 'Newest card first', clear: () => setSort('name') },
  ].filter(Boolean)
  const activeCount = activeChips.filter(c => c.key !== 'sort').length
  function resetFilters() { setList('all'); setCardF('all'); setStatus('all'); setGender('all'); setSort('name') }

  return (
    <div className="people-pane">
      <div className="people-top">
        <header className="people-head">
          <h1 className="section-title">People</h1>
          <span className="section-sub">{visible.length} {visible.length === 1 ? 'person' : 'people'}</span>
        </header>
        <div className="people-search-row">
          <div className="search-wrap">
            <Search className="search-icon" size={15} />
            <input className="search-input" type="search" placeholder="Search by name"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className={`filters-btn${activeCount ? ' on' : ''}`} onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal size={16} />
            Filters{activeCount > 0 && <span className="filters-count">{activeCount}</span>}
          </button>
        </div>

      </div>

      <Sheet open={filtersOpen} title="Filters" onClose={() => setFiltersOpen(false)}>
        <div className="filter-sheet">
          {activeChips.length > 0 && (
            <div className="fchoices">
              <div className="fchoices-label">Active filters</div>
              <div className="active-chips">
                {activeChips.map(c => (
                  <button key={c.key} className="active-chip" onClick={c.clear} aria-label={`Remove filter ${c.label}`}>
                    {c.label}<X size={13} strokeWidth={2.5} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <Choices label="Crew" value={list} onChange={setList}
            options={LIST_OPTIONS.map(o => ({ key: o.key, label: `${o.label} · ${counts[o.key]}` }))} />
          <Choices label="Connection card" value={cardF} onChange={setCardF} options={CARD_OPTIONS} />
          {statusOptions.length > 0 && (
            <Choices label="YA Status" value={status} onChange={setStatus}
              options={[{ key: 'all', label: 'Current' }, ...statusOptions.map(v => ({ key: v, label: v }))]} />
          )}
          <Choices label="Gender" value={gender} onChange={setGender} options={GENDER_OPTIONS} />
          <Choices label="Sort by" value={sort} onChange={setSort} options={SORT_OPTIONS} />
          <div className="filter-actions">
            <button className="msg-reset" onClick={resetFilters} disabled={!activeCount && sort === 'name'}>Reset</button>
            <button className="login-btn" onClick={() => setFiltersOpen(false)}>
              Show {visible.length} {visible.length === 1 ? 'person' : 'people'}
            </button>
          </div>
        </div>
      </Sheet>

      <div className="people-list" ref={ptr.ref}>
        {ptr.indicator}
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
