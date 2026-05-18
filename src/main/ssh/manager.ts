import { Client } from 'ssh2'
import fs from 'fs'
import { BrowserWindow } from 'electron'
import type { ServerConfig } from '../../shared/types.js'

interface ActiveSession {
  conn: Client
  stream: any
}

const sessions = new Map<string, ActiveSession>()
const connections = new Map<string, Client>()

export function connectSSH(
  event: Electron.IpcMainInvokeEvent,
  sessionId: string,
  config: ServerConfig,
  cols: number,
  rows: number,
): void {
  const conn = new Client()
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return

  const connectOpts: any = {
    host: config.host,
    port: config.port,
    username: config.username,
    readyTimeout: 5000,
    keepaliveInterval: 30000,
    keepaliveCountMax: 3,
  }

  if (config.authType === 'key' && config.privateKeyPath) {
    connectOpts.privateKey = fs.readFileSync(config.privateKeyPath)
    if (config.passphrase) connectOpts.passphrase = config.passphrase
  } else if (config.password) {
    connectOpts.password = config.password
  }

  conn.on('ready', () => {
    clearTimeout(timer)
    connections.set(sessionId, conn)

    conn.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => {
      if (err) {
        win.webContents.send('ssh-error', sessionId, err.message)
        return
      }

      sessions.set(sessionId, { conn, stream })
      win.webContents.send('ssh-ready', sessionId)

      stream.on('data', (data: Buffer) => {
        if (!win.isDestroyed()) win.webContents.send('ssh-data', sessionId, data.toString('utf-8'))
      })
      stream.stderr.on('data', (data: Buffer) => {
        if (!win.isDestroyed()) win.webContents.send('ssh-data', sessionId, data.toString('utf-8'))
      })
      stream.on('close', () => {
        win.webContents.send('ssh-close', sessionId)
        sessions.delete(sessionId)
        connections.delete(sessionId)
      })
    })
  })

  conn.on('error', (err) => {
    clearTimeout(timer)
    if (win.isDestroyed()) return
    const msg = (err as any).code === 'ETIMEDOUT' || (err as any).code === 'ECONNREFUSED'
      ? `连接超时：无法连接到 ${config.host}:${config.port}，请检查地址和网络`
      : err.message.includes('timed out')
        ? `连接超时：${config.host} 未在 5 秒内响应，请检查服务器状态`
        : err.message.includes('All configured authentication methods failed')
          ? '认证失败：用户名或密码/密钥不正确'
          : err.message
    win.webContents.send('ssh-error', sessionId, msg)
  })

  const timer = setTimeout(() => {
    if (!connections.has(sessionId)) {
      conn.end()
      if (!win.isDestroyed()) {
        win.webContents.send('ssh-error', sessionId, `连接超时：${config.host} 未在 5 秒内响应，请检查服务器状态`)
      }
    }
  }, 6000)

  conn.connect(connectOpts)
}

export function sendInput(sessionId: string, data: string): void {
  const session = sessions.get(sessionId)
  if (session) session.stream.write(data)
}

export function resizeTerminal(sessionId: string, rows: number, cols: number): void {
  const session = sessions.get(sessionId)
  if (session) {
    try { session.stream.setWindow(rows, cols, rows * 16, cols * 8) } catch {}
  }
}

export function disconnectSSH(sessionId: string): void {
  const session = sessions.get(sessionId)
  if (session) {
    session.conn.end()
    sessions.delete(sessionId)
    connections.delete(sessionId)
  }
}

export function execCommand(
  event: Electron.IpcMainInvokeEvent,
  config: ServerConfig,
  command: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const conn = new Client()

    const connectOpts: any = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: 5000,
      keepaliveInterval: 30000,
      keepaliveCountMax: 3,
    }

    if (config.authType === 'key' && config.privateKeyPath) {
      connectOpts.privateKey = fs.readFileSync(config.privateKeyPath)
      if (config.passphrase) connectOpts.passphrase = config.passphrase
    } else if (config.password) {
      connectOpts.password = config.password
    }

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) { conn.end(); reject(err); return }

        const stdout: Buffer[] = []
        const stderr: Buffer[] = []

        stream.on('data', (data: Buffer) => stdout.push(data))
        stream.stderr.on('data', (data: Buffer) => stderr.push(data))
        stream.on('close', (code: number) => {
          conn.end()
          resolve({
            stdout: Buffer.concat(stdout).toString('utf-8'),
            stderr: Buffer.concat(stderr).toString('utf-8'),
            exitCode: code ?? 0,
          })
        })
      })
    })

    conn.on('error', reject)
    conn.connect(connectOpts)
  })
}

export function uploadFile(
  event: Electron.IpcMainInvokeEvent,
  config: ServerConfig,
  localPath: string,
  remotePath: string,
  uploadId: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    const win = BrowserWindow.fromWebContents(event.sender)

    const connectOpts: any = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: 15000,
      keepaliveInterval: 30000,
      keepaliveCountMax: 3,
    }

    if (config.authType === 'key' && config.privateKeyPath) {
      connectOpts.privateKey = fs.readFileSync(config.privateKeyPath)
      if (config.passphrase) connectOpts.passphrase = config.passphrase
    } else if (config.password) {
      connectOpts.password = config.password
    }

    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) { conn.end(); reject(err); return }

        const totalSize = fs.statSync(localPath).size

        sftp.fastPut(localPath, remotePath, {
          step(transferred: number) {
            if (win && !win.isDestroyed()) {
              win.webContents.send('ssh-upload-progress', uploadId, transferred, totalSize)
            }
          },
        }, (err) => {
          conn.end()
          if (err) reject(err)
          else resolve()
        })
      })
    })

    conn.on('error', reject)
    conn.connect(connectOpts)
  })
}

export function downloadFile(
  event: Electron.IpcMainInvokeEvent,
  config: ServerConfig,
  remotePath: string,
  localPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const conn = new Client()

    const connectOpts: any = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: 15000,
      keepaliveInterval: 30000,
      keepaliveCountMax: 3,
    }

    if (config.authType === 'key' && config.privateKeyPath) {
      connectOpts.privateKey = fs.readFileSync(config.privateKeyPath)
      if (config.passphrase) connectOpts.passphrase = config.passphrase
    } else if (config.password) {
      connectOpts.password = config.password
    }

    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) { conn.end(); reject(err); return }

        sftp.fastGet(remotePath, localPath, (err) => {
          conn.end()
          if (err) reject(err)
          else resolve()
        })
      })
    })

    conn.on('error', reject)
    conn.connect(connectOpts)
  })
}

export function disconnectAll(): void {
  for (const session of sessions.values()) session.conn.end()
  sessions.clear()
  connections.clear()
}
