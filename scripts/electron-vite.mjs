// Runs the electron-vite CLI with a clean environment.
// Some hosts (e.g. VS Code extension terminals) export ELECTRON_RUN_AS_NODE=1,
// which makes Electron start as plain Node and breaks the app.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
// The package's "exports" hide the bin file, so locate it next to the resolved entry.
const cli = join(dirname(require.resolve('electron-vite')), '..', 'bin', 'electron-vite.js')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], { stdio: 'inherit', env })
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
