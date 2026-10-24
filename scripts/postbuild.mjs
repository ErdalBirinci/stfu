import { copyFileSync } from 'node:fs'
import { join } from 'node:path'

// GitHub Pages has no SPA fallback, so a copy of the shell answers deep links
// such as /dobby and lets the client router take over.
copyFileSync(join('dist', 'index.html'), join('dist', '404.html'))
console.log('postbuild: dist/404.html written')
