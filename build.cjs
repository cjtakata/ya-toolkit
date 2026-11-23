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
console.log('✓  Assets     → dist/')

console.log('\n✅  Post-build complete')
console.log('   dist/')
console.log('   └── people/             (React app — Home · Search · Profile)')
