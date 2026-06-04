// Post-build: assemble the three apps into dist/
//   dist/              ← Hub (root)
//   dist/people/       ← React People app (built by Vite)
//   dist/calendar/     ← Calendar static HTML
const fs   = require('fs')
const path = require('path')

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}

// Hub → dist root
copy('hub.html', 'dist/index.html')
console.log('✓  Hub        → dist/index.html')

// Calendar → dist/calendar/
copy('calendar/index.html', 'dist/calendar/index.html')
copy('calendar/ya.svg',     'dist/calendar/ya.svg')
console.log('✓  Calendar   → dist/calendar/')

// Icons & manifest at dist root (Hub needs them)
;['icon-192.png','icon-512.png','apple-touch-icon.png','ya.svg','manifest.json'].forEach(f => {
  const src = path.join('public', f)
  if (fs.existsSync(src)) {
    copy(src, path.join('dist', f))
  }
})
console.log('✓  Assets     → dist/')

console.log('\n✅  Post-build complete')
console.log('   dist/')
console.log('   ├── index.html          (Hub)')
console.log('   ├── calendar/           (Calendar)')
console.log('   └── people/             (React app)')
