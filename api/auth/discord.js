export default function handler(req, res) {
  const state  = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  const appUrl = process.env.APP_URL || `https://${process.env.VERCEL_URL}`

  const params = new URLSearchParams({
    client_id:     process.env.DISCORD_CLIENT_ID,
    redirect_uri:  `${appUrl}/api/auth/callback`,
    response_type: 'code',
    scope:         'identify guilds guilds.members.read',
    state,
  })

  res.setHeader('Set-Cookie', `discord_state=${state}; HttpOnly; Path=/; Max-Age=300; SameSite=Lax`)
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`)
}
