import { importPKCS8, SignJWT } from 'jose'

// ── Google service-account auth → access token (cached) ──────────
let _token = null, _tokenExp = 0
async function getToken() {
  if (_token && Date.now() < _tokenExp - 60_000) return _token
  const sa  = JSON.parse(process.env.GOOGLE_SA_JSON)
  const key = await importPKCS8(sa.private_key, 'RS256')
  const now = Math.floor(Date.now() / 1000)
  const jwt = await new SignJWT({ scope: 'https://www.googleapis.com/auth/spreadsheets' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now).setExpirationTime(now + 3600)
    .sign(key)
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const d = await r.json()
  if (!d.access_token) throw new Error('Google token error: ' + JSON.stringify(d))
  _token = d.access_token
  _tokenExp = Date.now() + (d.expires_in || 3600) * 1000
  return _token
}

function sheetId()        { return process.env.GOOGLE_CAL_SHEET_ID }
function attendanceSheet() { return process.env.GOOGLE_CAL_SHEET_ID } // same workbook, different tab

async function api(path, options = {}) {
  const token = await getToken()
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId()}${path}`, {
    ...options,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  if (!r.ok) throw new Error(`Sheets ${r.status}: ${await r.text()}`)
  return r.json()
}

// ── Serial <-> friendly conversions (Sheets 1900 date system) ────
function serialToISODate(n) {
  if (typeof n !== 'number') return ''
  const d = new Date(Math.round((n - 25569) * 86400000))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}
function serialToHM(n) {
  if (typeof n !== 'number') return ''
  const mins = Math.round((n % 1) * 1440)
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}
function hmTo12(hm) {
  if (!hm) return ''
  const [h, m] = hm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

// Columns: A Date | B DoW | C Event | D Owner | E Details | F Start | G End | H Type | I Doc | J DaysOut | K WeeksOut
function rowValues(ev, rowNum) {
  return [
    ev.date || '',                            // A  (ISO date; USER_ENTERED parses to a date)
    `=A${rowNum}`,                            // B  DoW (date-formatted cell, mirrors existing rows)
    ev.event || '',                          // C
    ev.owner || '',                          // D
    ev.details || '',                        // E
    ev.start ? hmTo12(ev.start) : '',        // F
    ev.end ? hmTo12(ev.end) : '',            // G
    ev.type || '',                           // H
    ev.doc || '',                            // I
    `=DATEDIF(TODAY(),A${rowNum},"D")`,       // J  Days Out
    `=DATEDIF(TODAY(),A${rowNum},"D")/7`,     // K  Weeks Out
  ]
}

// ── Public ops ───────────────────────────────────────────────────
export async function listEvents() {
  const d = await api('/values/A2:K?valueRenderOption=UNFORMATTED_VALUE')
  return (d.values || []).map((r, i) => ({
    row:     i + 2,
    date:    serialToISODate(r[0]),
    event:   r[2] || '',
    owner:   r[3] || '',
    details: r[4] || '',
    start:   serialToHM(r[5]),
    end:     serialToHM(r[6]),
    type:    r[7] || '',
    doc:     r[8] || '',
  })).filter(e => e.event || e.date)
}

async function nextRow() {
  const d = await api('/values/A:A')
  return (d.values ? d.values.length : 0) + 1
}

export async function addEvent(ev) {
  const row = await nextRow()
  await api(`/values/A${row}:K${row}?valueInputOption=USER_ENTERED`, {
    method: 'PUT', body: JSON.stringify({ values: [rowValues(ev, row)] }),
  })
  return { row, ...ev }
}

export async function updateEvent(row, ev) {
  await api(`/values/A${row}:K${row}?valueInputOption=USER_ENTERED`, {
    method: 'PUT', body: JSON.stringify({ values: [rowValues(ev, row)] }),
  })
  return { row, ...ev }
}

let _gid = null
async function firstSheetGid() {
  if (_gid != null) return _gid
  const d = await api('?fields=sheets.properties.sheetId')
  _gid = d.sheets[0].properties.sheetId
  return _gid
}

// ── Attendance log (tab: "Attendance") ──────────────────────────────────────
// Columns: Date | Time (PT) | PersonID | Name | Crew | YA Status | Checked In By

const ATTENDANCE_TAB = 'Attendance'

async function attendanceApi(path, options = {}) {
  const token = await getToken()
  const id    = attendanceSheet()
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}${path}`, {
    ...options,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  if (!r.ok) throw new Error(`Sheets(attendance) ${r.status}: ${await r.text()}`)
  return r.json()
}

export async function logAttendance({ personId, name, crew, status, leaderName }) {
  const now = new Date()
  const ptDate = now.toLocaleDateString('en-CA',  { timeZone: 'America/Los_Angeles' })
  const ptTime = now.toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit' })
  const range  = `${ATTENDANCE_TAB}!A:G`
  await attendanceApi(`/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body:   JSON.stringify({ values: [[ptDate, ptTime, personId, name, crew, status, leaderName]] }),
  })
}

export async function getTodayAttendance() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const range  = `${ATTENDANCE_TAB}!A:D`
  const d = await attendanceApi(`/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`)
  return (d.values || [])
    .filter(r => r[0] === today && r[2])
    .map(r => ({ date: r[0], time: r[1] || '', personId: r[2], name: r[3] || '' }))
}

export async function deleteEvent(row) {
  const gid = await firstSheetGid()
  await api(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: gid, dimension: 'ROWS', startIndex: row - 1, endIndex: row } } }] }),
  })
  return { row }
}
