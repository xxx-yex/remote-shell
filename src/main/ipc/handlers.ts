import { clipboard, dialog, ipcMain, BrowserWindow } from 'electron'
import { basename } from 'path'
import { connectSSH, sendInput, resizeTerminal, disconnectSSH, execCommand, uploadFile, downloadFile } from '../ssh/manager.js'
import { getServers, addServer, removeServer, updateServer } from '../../shared/config.js'

export function registerIpcHandlers(): void {
  // Window controls
  ipcMain.on('window-minimize', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize()
  })
  ipcMain.on('window-maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.on('window-close', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close()
  })

  // Server config
  ipcMain.handle('get-servers', () => getServers())

  ipcMain.handle('add-server', (_event, server) => {
    addServer(server)
    return true
  })

  ipcMain.handle('remove-server', (_event, id) => {
    removeServer(id)
    return true
  })

  ipcMain.handle('update-server', (_event, id, updates) => {
    updateServer(id, updates)
    return true
  })

  // SSH terminal
  ipcMain.on('ssh-connect', (event, sessionId, config, cols, rows) => {
    connectSSH(event, sessionId, config, cols, rows)
  })

  ipcMain.on('ssh-input', (_event, sessionId, data) => {
    sendInput(sessionId, data)
  })

  ipcMain.on('ssh-resize', (_event, sessionId, rows, cols) => {
    resizeTerminal(sessionId, rows, cols)
  })

  ipcMain.on('ssh-disconnect', (_event, sessionId) => {
    disconnectSSH(sessionId)
  })

  // One-shot exec
  ipcMain.handle('ssh-exec', (event, config, command) => {
    return execCommand(event, config, command)
  })

  // SFTP upload
  ipcMain.handle('ssh-upload', (event, config, localPath, remotePath, uploadId) => {
    return uploadFile(event, config, localPath, remotePath, uploadId)
  })

  // SFTP download (shows save dialog)
  ipcMain.handle('ssh-download', async (event, config, remotePath) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: basename(remotePath),
    })
    if (canceled || !filePath) return false
    await downloadFile(event, config, remotePath, filePath)
    return true
  })

  // Clipboard
  ipcMain.handle('clipboard-read', () => clipboard.readText())
  ipcMain.handle('clipboard-write', (_event, text) => clipboard.writeText(text))
}
