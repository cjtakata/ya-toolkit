// Post-build: put the PWA icons + manifest at the dist root.
//   dist/people/       ← React app (built by Vite); "/" redirects here (vercel.json)
const fs   = require('fs')
const path = require('path')

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}

// Icons & manifest at dist root (manifest.json is linked as /manifest.json)
;['icon-192.png','icon-512.png','apple-touch-icon.png','ya.svg','manifest.json','sw.js'].forEach(f => {
  const src = path.join('public', f)
  if (fs.existsSync(src)) {
    copy(src, path.join('dist', f))
  }
})
// Link-preview images
for (const f of fs.existsSync('public/og') ? fs.readdirSync('public/og') : []) copy(path.join('public/og', f), path.join('dist/og', f))
console.log('✓  Assets     → dist/')

// Copies of the app page with their own link previews (vercel.json routes
// /install and /p/<id> to them; the app itself is identical). Never names
// anyone: previews are fetched without signing in.
const SITE = 'https://ya-toolkit.vercel.app'
const PREVIEWS = {
  'install.html': { title: 'Get YA Toolkit on your phone', desc: 'Add it to your home screen in a minute, then turn on notifications for new guests and @mentions.', image: 'install' },
  'guest.html':   { title: 'A guest in YA Toolkit', desc: 'Tap to open their profile in YA Toolkit (sign-in required).', image: 'guest' },
}
const page = fs.readFileSync('dist/people/index.html', 'utf8')
if (!/<!-- og:start -->[\s\S]*<!-- og:end -->/.test(page)) throw new Error('index.html is missing its og:start/og:end block')
for (const [file, p] of Object.entries(PREVIEWS)) {
  const block = [
    `<meta name="description" content="${p.desc}" />`,
    '<meta property="og:site_name" content="YA Toolkit" />',
    '<meta property="og:type" content="website" />',
    `<meta property="og:title" content="${p.title}" />`,
    `<meta property="og:description" content="${p.desc}" />`,
    `<meta property="og:image" content="${SITE}/og/${p.image}.png" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta name="twitter:card" content="summary_large_image" />',
  ].join('\n    ')
  fs.writeFileSync(path.join('dist', file),
    page.replace(/<!-- og:start -->[\s\S]*<!-- og:end -->/, `<!-- og:start -->\n    ${block}\n    <!-- og:end -->`)
        .replace(/<title>[^<]*<\/title>/, `<title>${p.title}</title>`))
}
console.log('✓  Previews   → dist/install.html, dist/guest.html')

console.log('\n✅  Post-build complete')
console.log('   dist/')
console.log('   └── people/             (React app — Home · Search · Profile)')
