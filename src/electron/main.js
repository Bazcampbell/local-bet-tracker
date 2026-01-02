import { app, BrowserWindow } from 'electron'
import path from 'path'
import { spawn } from 'child_process'

const isDev = process.env.NODE_ENV !== 'production'
let serverProcess

function startServerProcess() {
  // Start the API as a separate node process so native modules and file paths behave the same as development
  const nodeExec = process.execPath
  const serverPath = path.join(process.cwd(), 'server-sqlite.js')

  // Ensure we use a writable data dir in the user's profile (persisted across updates)
  const userDataDir = path.join(app.getPath('userData'), 'data')
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true })

  // If a bundled seed DB exists, copy it to the user's data dir on first run
  const bundledDbDev = path.join(process.cwd(), 'data', 'bets.db')
  const bundledDbProd = path.join(process.resourcesPath || process.cwd(), 'data', 'bets.db')
  const userDbPath = path.join(userDataDir, 'bets.db')

  if (!fs.existsSync(userDbPath)) {
    if (fs.existsSync(bundledDbDev)) {
      fs.copyFileSync(bundledDbDev, userDbPath)
    } else if (fs.existsSync(bundledDbProd)) {
      try {
        fs.copyFileSync(bundledDbProd, userDbPath)
      } catch (err) {
        console.warn('Failed to copy bundled DB to userData (prod):', err.message)
      }
    }
    // If no bundled DB exists, server will create DB and tables on first start
  }

  // Pass DATA_DIR to the server process so it uses the user's data directory
  const env = Object.assign({}, process.env, { DATA_DIR: userDataDir })
  serverProcess = spawn(nodeExec, [serverPath], { stdio: 'inherit', env })
  serverProcess.on('close', (code) => {
    console.log('Server process exited', code)
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(process.cwd(), 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  startServerProcess()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill()
  }
  if (process.platform !== 'darwin') app.quit()
})

app.on('quit', () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill()
})