// The app-icon badge number, shared by the app (src/App.jsx) and the server's
// push notifications (api/_lib/push.js), so they always agree with Home:
//   new cards not claimed yet in my crew (or with no crew yet)
// + guests I've claimed but not texted yet.

// A guest belongs to the chosen crew if it's theirs or they have no crew yet.
export const inCrew = (c, myCrew) =>
  !myCrew || myCrew === 'all' || c.person?.list === myCrew || c.person?.list === 'unassigned'

export function badgeCount(cards, { crew, me }) {
  let n = 0
  for (const c of cards) {
    if (c.state === 'waiting' && inCrew(c, crew)) n++
    else if (c.state === 'claimed' && me && c.claimedBy === me) n++
  }
  return n
}
