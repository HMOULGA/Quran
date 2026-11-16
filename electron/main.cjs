// Application Windows (Electron). Sert le build Vite via un protocole sécurisé app://
// pour que fetch, les Web Workers et WebAssembly (Whisper) fonctionnent comme sur le web.
const { app, BrowserWindow, protocol, net, session, shell } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
])

const DIST = path.join(__dirname, '..', 'dist')
const isDev = !!process.env.VITE_DEV_SERVER_URL

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 380,
    minHeight: 600,
    title: 'Itqan',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    backgroundColor: '#f7f3ea',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  // Les liens externes s'ouvrent dans le navigateur
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  if (isDev) win.loadURL(process.env.VITE_DEV_SERVER_URL)
  else win.loadURL('app://itqan/index.html')
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url)
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)))
    if (!file.startsWith(DIST)) return new Response('Interdit', { status: 403 })
    return net.fetch(pathToFileURL(file).toString())
  })
  // Micro autorisé pour la récitation
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media'))
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media')
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
