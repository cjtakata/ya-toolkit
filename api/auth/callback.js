import { createSessionCookie, parseCookies } from '../_lib/auth.js'
import { resolveCrews } from '../_lib/leaders.js'

export default async function handler(req, res) {
  const { code, state, error } = req.query

  if (error) return res.redirect('/people?error=auth_failed')

  const cookies = parseCookies(req)
  if (!state || state !== cookies.discord_state) {
    return res.status(400).send('Invalid state — please try signing in again.')
  }

  const appUrl = process.env.APP_URL || `https://${process.env.VERCEL_URL}`

  try {
    // Exchange authorization code for access token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  `${appUrl}/api/auth/callback`,
      }),
    })
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${await tokenRes.text()}`)
    const { access_token } = await tokenRes.json()

    // Fetch Discord user profile
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (!userRes.ok) throw new Error('User fetch failed')
    const discordUser = await userRes.json()

    // Fetch list of guilds the user belongs to
    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (!guildsRes.ok) throw new Error('Guilds fetch failed')
    const guilds = await guildsRes.json()

    const isMember = guilds.some(g => g.id === process.env.DISCORD_GUILD_ID)
    if (!isMember) return res.redirect('/people?error=not_member')

    // Fetch this user's roles within the guild to derive their crew(s).
    let roleIds = []
    try {
      const memberRes = await fetch(
        `https://discord.com/api/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`,
        { headers: { Authorization: `Bearer ${access_token}` } }
      )
      if (memberRes.ok) {
        const member = await memberRes.json()
        roleIds = Array.isArray(member.roles) ? member.roles : []
      } else {
        console.error('Member fetch failed:', memberRes.status, await memberRes.text())
      }
    } catch (e) {
      console.error('Member fetch error:', e.message)
    }

    const crews = resolveCrews({ roleIds, discordId: discordUser.id })

    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=64`
      : null

    const sessionCookie = await createSessionCookie({
      id:          discordUser.id,
      username:    discordUser.username,
      global_name: discordUser.global_name || discordUser.username,
      avatar:      avatarUrl,
      crews,
    })

    res.setHeader('Set-Cookie', [
      sessionCookie,
      `discord_state=; HttpOnly; Max-Age=0; Path=/`,
    ])
    res.redirect('/people')
  } catch (err) {
    console.error('Auth callback error:', err)
    res.redirect('/people?error=auth_failed')
  }
}
