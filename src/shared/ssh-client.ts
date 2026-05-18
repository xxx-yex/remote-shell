import { Client } from 'ssh2'
import fs from 'fs'
import type { ServerConfig, DirectoryEntry, ServerStats } from './types'

export class SSHClient {
  private conn: Client | null = null
  private config: ServerConfig
  private connected = false

  constructor(config: ServerConfig) {
    this.config = config
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn = new Client()

      const connectOpts: any = {
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        readyTimeout: 15000,
      }

      if (this.config.authType === 'key' && this.config.privateKeyPath) {
        connectOpts.privateKey = fs.readFileSync(this.config.privateKeyPath)
        if (this.config.passphrase) connectOpts.passphrase = this.config.passphrase
      } else if (this.config.password) {
        connectOpts.password = this.config.password
      }

      this.conn.on('ready', () => {
        this.connected = true
        resolve()
      })

      this.conn.on('error', (err) => {
        if (!this.connected) reject(err)
      })

      this.conn.connect(connectOpts)
    })
  }

  exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      if (!this.conn) return reject(new Error('Not connected'))

      this.conn.exec(command, (err, stream) => {
        if (err) return reject(err)

        const stdout: Buffer[] = []
        const stderr: Buffer[] = []

        stream.on('data', (data: Buffer) => stdout.push(data))
        stream.stderr.on('data', (data: Buffer) => stderr.push(data))
        stream.on('close', (code: number) => {
          resolve({
            stdout: Buffer.concat(stdout).toString('utf-8'),
            stderr: Buffer.concat(stderr).toString('utf-8'),
            exitCode: code ?? 0,
          })
        })
      })
    })
  }

  shell(
    opts: { cols: number; rows: number },
    onData: (data: string) => void,
    onClose: () => void,
  ): Promise<{ write: (data: string) => void; resize: (rows: number, cols: number) => void }> {
    return new Promise((resolve, reject) => {
      if (!this.conn) return reject(new Error('Not connected'))

      this.conn.shell({ term: 'xterm-256color', cols: opts.cols, rows: opts.rows }, (err, stream) => {
        if (err) return reject(err)

        stream.on('data', (data: Buffer) => onData(data.toString('utf-8')))
        stream.stderr.on('data', (data: Buffer) => onData(data.toString('utf-8')))
        stream.on('close', () => {
          this.connected = false
          onClose()
        })

        resolve({
          write: (data: string) => stream.write(data),
          resize: (rows: number, cols: number) => {
            try { stream.setWindow(rows, cols, rows * 16, cols * 8) } catch {}
          },
        })
      })
    })
  }

  async listDir(remotePath: string): Promise<DirectoryEntry[]> {
    const cmd = `ls -la --time-style=full-iso ${remotePath} 2>/dev/null || stat -c '%A %s %Y %U %G %n' ${remotePath}/*`
    const { stdout, exitCode } = await this.exec(cmd)

    if (exitCode !== 0 && !stdout.trim()) return []

    const entries: DirectoryEntry[] = []
    const lines = stdout.trim().split('\n')

    for (const line of lines) {
      const match = line.match(/^([dlcbps-])([rwxsStT-]{9})\s+\d+\s+(\S+)\s+(\S+)\s+(\d+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(.+)/)
      if (!match) continue

      const typeChar = match[1]
      const type: DirectoryEntry['type'] =
        typeChar === 'd' ? 'directory' :
        typeChar === 'l' ? 'symlink' :
        typeChar === '-' ? 'file' : 'other'

      entries.push({
        name: match[7].split(' -> ')[0],
        path: remotePath === '/' ? `/${match[7].split(' -> ')[0]}` : `${remotePath}/${match[7].split(' -> ')[0]}`,
        type,
        size: parseInt(match[5], 10),
        modifyTimeStr: match[6],
        permissions: match[2],
        owner: match[3],
        group: match[4],
      })
    }

    return entries
  }

  async readFile(remotePath: string): Promise<string> {
    const { stdout, exitCode, stderr } = await this.exec(`cat "${remotePath}"`)
    if (exitCode !== 0) throw new Error(stderr || `Failed to read ${remotePath}`)
    return stdout
  }

  async writeFile(remotePath: string, content: string): Promise<void> {
    const escaped = content.replace(/'/g, "'\\''")
    const { exitCode, stderr } = await this.exec(`cat > "${remotePath}" << 'REMOTE_SHELL_EOF'\n${content}\nREMOTE_SHELL_EOF`)
    if (exitCode !== 0) throw new Error(stderr || `Failed to write ${remotePath}`)
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.conn) return reject(new Error('Not connected'))

      this.conn.sftp((err, sftp) => {
        if (err) return reject(err)

        sftp.fastPut(localPath, remotePath, (err) => {
          if (err) return reject(err)
          resolve()
        })
      })
    })
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.conn) return reject(new Error('Not connected'))

      this.conn.sftp((err, sftp) => {
        if (err) return reject(err)

        sftp.fastGet(remotePath, localPath, (err) => {
          if (err) return reject(err)
          resolve()
        })
      })
    })
  }

  async getStats(): Promise<ServerStats> {
    const cmd = `echo "===CPU===" && top -bn1 | grep "Cpu(s)" && echo "===MEM===" && free -m && echo "===DISK===" && df -h / && echo "===UP===" && uptime`
    const { stdout } = await this.exec(cmd)

    const cpuMatch = stdout.match(/Cpu\(s\):\s*([\d.]+)\s*%/)

    const memLines = stdout.match(/Mem:\s*(\d+)\s+(\d+)/)

    const diskMatch = stdout.match(/\/\S*\s+(\S+)\s+(\S+)\s+\S+\s+(\d+)%/)

    const uptimeMatch = stdout.match(/up\s+(.+?),\s*\d+\s*user/)

    const loadMatch = stdout.match(/load average:\s*(.+)/)

    const memTotal = memLines ? parseInt(memLines[1], 10) : 0
    const memUsed = memLines ? parseInt(memLines[2], 10) : 0

    return {
      cpuUsage: cpuMatch ? parseFloat(cpuMatch[1]) : 0,
      memTotal,
      memUsed,
      memPercent: memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0,
      diskTotal: diskMatch ? diskMatch[1] : '?',
      diskUsed: diskMatch ? diskMatch[2] : '?',
      diskPercent: diskMatch ? parseInt(diskMatch[3], 10) : 0,
      uptime: uptimeMatch ? uptimeMatch[1].trim() : '?',
      loadAvg: loadMatch ? loadMatch[1].trim() : '?',
    }
  }

  disconnect(): void {
    if (this.conn) {
      this.conn.end()
      this.conn = null
      this.connected = false
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  getClient(): Client | null {
    return this.conn
  }
}

// Connection pool for MCP server (no Electron dependency)
const pool = new Map<string, SSHClient>()

export async function getOrCreateClient(config: ServerConfig): Promise<SSHClient> {
  const existing = pool.get(config.id)
  if (existing && existing.isConnected()) return existing

  const client = new SSHClient(config)
  await client.connect()
  pool.set(config.id, client)
  return client
}

export function disconnectAll(): void {
  for (const client of pool.values()) client.disconnect()
  pool.clear()
}
