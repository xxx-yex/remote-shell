import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc/handlers.js'
import { disconnectAll } from './ssh/manager.js'
import { runMcpServer } from '../mcp/index.js'

const isMcpMode = process.argv.includes('--mcp')

if (isMcpMode) {
  app.on('window-all-closed', () => {})
  if (app.dock) app.dock.hide()

  runMcpServer().catch((err) => {
    console.error('Fatal:', err)
    app.quit()
  })
} else {
  let mainWindow: BrowserWindow | null = null

  const gotTheLock = app.requestSingleInstanceLock()

  if (!gotTheLock) {
    app.quit()
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
    })

    app.whenReady().then(() => {
      registerIpcHandlers()
      createWindow()

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
      })
    })
  }

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      title: 'Remote Shell',
      frame: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    if (process.env['ELECTRON_RENDERER_URL']) {
      mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    mainWindow.on('closed', () => {
      mainWindow = null
    })
  }

  app.on('window-all-closed', () => {
    disconnectAll()
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    disconnectAll()
  })
}
