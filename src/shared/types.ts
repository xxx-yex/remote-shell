export interface ServerConfig {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  password?: string
  privateKeyPath?: string
  passphrase?: string
  group?: string
}

export interface DirectoryEntry {
  name: string
  path: string
  type: 'file' | 'directory' | 'symlink' | 'other'
  size: number
  modifyTimeStr: string
  permissions: string
  owner: string
  group: string
}

export interface ServerStats {
  cpuUsage: number
  memTotal: number
  memUsed: number
  memPercent: number
  diskTotal: string
  diskUsed: string
  diskPercent: number
  uptime: string
  loadAvg: string
}

export interface ConnectOptions {
  sessionId: string
  serverId: string
  cols?: number
  rows?: number
}
