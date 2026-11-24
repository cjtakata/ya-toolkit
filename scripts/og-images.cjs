// Renders the link-preview images (public/og/*.png, 1200×630) that Messages,
// Slack etc. show when a YA Toolkit link is shared. Run after changing them:
//   node scripts/og-images.cjs
// Guest previews never name the guest: the preview is fetched without
// signing in, so anyone with the link could see it.
const { chromium } = require('playwright')
const fs = require('fs'), path = require('path')
const svg = fs.readFileSync(path.join(__dirname, '../public/ya.svg'), 'utf8')
const logo = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
const CARDS = {
  app:     { title: 'YA Toolkit',                  sub: 'For Venture Young Adults leaders', note: 'Follow up with new guests, together.' },
  guest:   { title: 'A guest in YA Toolkit',        sub: 'Tap to open their profile',        note: 'Sign-in required · Venture Young Adults' },
  install: { title: 'Get YA Toolkit on your phone', sub: 'Add it to your home screen',       note: 'Then turn on notifications for new guests and @mentions' },
}
;(async () => {
  const b = await chromium.launch()
  for (const [name, c] of Object.entries(CARDS)) {
    const pg = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
    await pg.setContent(`<html><body style="margin:0">
      <div style="width:1200px;height:630px;box-sizing:border-box;padding:90px 96px;background:#f8f9fb;display:flex;align-items:center;gap:64px;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif">
        <div style="flex-shrink:0;width:300px;height:300px;border-radius:68px;background:#0a0a0a;display:grid;place-items:center">
          <img src="${logo}" style="width:72%;height:72%"></div>
        <div style="display:flex;flex-direction:column;gap:18px;min-width:0">
          <div style="font-size:68px;font-weight:800;letter-spacing:-1.5px;color:#111827;line-height:1.05">${c.title}</div>
          <div style="font-size:38px;font-weight:600;color:#4f46e5">${c.sub}</div>
          <div style="font-size:30px;color:#6b7280;line-height:1.3">${c.note}</div>
        </div>
      </div></body></html>`)
    await pg.waitForTimeout(150)
    await pg.screenshot({ path: path.join(__dirname, `../public/og/${name}.png`) })
    await pg.close()
  }
  await b.close()
})()
