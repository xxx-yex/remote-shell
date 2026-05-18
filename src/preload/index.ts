import { contextBridge, ipcRenderer } from 'electron'

let _getPathForFile: ((file: File) => string) | null = null
try {
  const { webUtils } = require('electron')
  _getPathForFile = (file) => webUtils.getPathForFile(file)
} catch {}

contextBridge.exposeInMainWorld('api', {
  // Window controls
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  // Server config
  getServers: () => ipcRenderer.invoke('get-servers'),
  addServer: (server: any) => ipcRenderer.invoke('add-server', server),
  removeServer: (id: string) => ipcRenderer.invoke('remove-server', id),
  updateServer: (id: string, updates: any) => ipcRenderer.invoke('update-server', id, updates),

  // File path from drag-drop File object
  getPathForFile: (file: File) => {
    if (_getPathForFile) return _getPathForFile(file)
    return (file as any).path || ''
  },

  // SSH terminal
  sshConnect: (sessionId: string, config: any, cols: number, rows: number) =>
    ipcRenderer.send('ssh-connect', sessionId, config, cols, rows),
  sshInput: (sessionId: string, data: string) =>
    ipcRenderer.send('ssh-input', sessionId, data),
  sshResize: (sessionId: string, rows: number, cols: number) =>
    ipcRenderer.send('ssh-resize', sessionId, rows, cols),
  sshDisconnect: (sessionId: string) =>
    ipcRenderer.send('ssh-disconnect', sessionId),

  // One-shot exec
  sshExec: (config: any, command: string) =>
    ipcRenderer.invoke('ssh-exec', config, command),

  // SFTP upload
  sshUpload: (config: any, localPath: string, remotePath: string, uploadId: string) =>
    ipcRenderer.invoke('ssh-upload', config, localPath, remotePath, uploadId),

  // SFTP download
  sshDownload: (config: any, remotePath: string) =>
    ipcRenderer.invoke('ssh-download', config, remotePath),

  // Clipboard
  clipboardRead: () => ipcRenderer.invoke('clipboard-read'),
  clipboardWrite: (text: string) => ipcRenderer.invoke('clipboard-write', text),

  // Event listeners (main -> renderer)
  onSshReady: (callback: (sessionId: string) => void) => {
    const handler = (_event: any, sessionId: string) => callback(sessionId)
    ipcRenderer.on('ssh-ready', handler)
    return () => ipcRenderer.removeListener('ssh-ready', handler)
  },
  onSshData: (callback: (sessionId: string, data: string) => void) => {
    const handler = (_event: any, sessionId: string, data: string) => callback(sessionId, data)
    ipcRenderer.on('ssh-data', handler)
    return () => ipcRenderer.removeListener('ssh-data', handler)
  },
  onSshError: (callback: (sessionId: string, error: string) => void) => {
    const handler = (_event: any, sessionId: string, error: string) => callback(sessionId, error)
    ipcRenderer.on('ssh-error', handler)
    return () => ipcRenderer.removeListener('ssh-error', handler)
  },
  onSshClose: (callback: (sessionId: string) => void) => {
    const handler = (_event: any, sessionId: string) => callback(sessionId)
    ipcRenderer.on('ssh-close', handler)
    return () => ipcRenderer.removeListener('ssh-close', handler)
  },

  onSshUploadProgress: (callback: (uploadId: string, transferred: number, total: number) => void) => {
    const handler = (_event: any, uploadId: string, transferred: number, total: number) => callback(uploadId, transferred, total)
    ipcRenderer.on('ssh-upload-progress', handler)
    return () => ipcRenderer.removeListener('ssh-upload-progress', handler)
  },
})
