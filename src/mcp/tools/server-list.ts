import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { loadServers } from '../lib/load-config.js'

export function registerServerList(server: McpServer) {
  server.tool('server_list', 'List all saved remote servers (passwords are masked)', {}, async () => {
    const servers = loadServers()
    const masked = servers.map((s) => ({
      id: s.id,
      name: s.name,
      host: s.host,
      port: s.port,
      username: s.username,
      authType: s.authType,
      group: s.group ?? null,
      password: s.password ? '********' : undefined,
      privateKeyPath: s.privateKeyPath ?? undefined,
    }))

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(masked, null, 2) }],
    }
  })
}
