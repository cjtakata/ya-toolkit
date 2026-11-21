import { requireAuth } from './_lib/auth.js'

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return
  res.json({
    id:          user.id,
    username:    user.username,
    global_name: user.global_name,
    avatar:      user.avatar,
    // From the leader's PCO Crew field at sign-in (see auth/magic-request.js).
    crews:       user.crews || [],
  })
}
