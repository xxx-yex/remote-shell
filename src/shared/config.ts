import Store from 'electron-store'
import type { ServerConfig } from './types'

interface AppStore {
  servers: ServerConfig[]
  theme: 'light' | 'dark' | 'system'
}

const store = new Store<AppStore>({
  name: 'config',
  defaults: {
    servers: [],
    theme: 'dark',
  },
})

export function getServers(): ServerConfig[] {
  return store.get('servers', [])
}

export function getServer(id: string): ServerConfig | undefined {
  return getServers().find((s) => s.id === id)
}

export function addServer(server: ServerConfig): void {
  const servers = getServers()
  servers.push(server)
  store.set('servers', servers)
}

export function removeServer(id: string): void {
  store.set('servers', getServers().filter((s) => s.id !== id))
}

export function updateServer(id: string, updates: Partial<ServerConfig>): void {
  const servers = getServers()
  const idx = servers.findIndex((s) => s.id === id)
  if (idx >= 0) {
    servers[idx] = { ...servers[idx], ...updates }
    store.set('servers', servers)
  }
}

export default store
