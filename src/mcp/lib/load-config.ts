import fs from 'fs'
import path from 'path'
import os from 'os'
import type { ServerConfig } from '../../shared/types.js'

function getElectronStoreDir(): string {
  const appName = 'remote-shell'
  const platform = os.platform()
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), appName)
  }
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appName)
  }
  return path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
    appName,
  )
}

export function getConfigPath(): string {
  const electronStorePath = path.join(getElectronStoreDir(), 'config.json')
  if (fs.existsSync(electronStorePath)) return electronStorePath

  const fallback = path.join(os.homedir(), '.remote-shell', 'servers.json')
  return fallback
}

export function loadServers(): ServerConfig[] {
  const configPath = getConfigPath()
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const data = JSON.parse(raw)
    // electron-store wraps in { servers: [...] }
    if (Array.isArray(data)) return data
    if (data.servers && Array.isArray(data.servers)) return data.servers
    return []
  } catch {
    return []
  }
}

export function findServer(idOrHost: string): ServerConfig | undefined {
  const servers = loadServers()
  return servers.find((s) => s.id === idOrHost || s.host === idOrHost || s.name === idOrHost)
}
