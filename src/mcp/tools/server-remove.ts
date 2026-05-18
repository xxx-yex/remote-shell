import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import fs from 'fs'
import { loadServers, getConfigPath, findServer } from '../lib/load-config.js'

export function registerServerRemove(server: McpServer) {
  server.tool(
    'server_remove',
    'Remove a saved remote server from the configuration',
    {
      server: z.string().describe('Server ID or hostname to remove'),
    },
    async (params) => {
      const existing = findServer(params.server)
      if (!existing) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: `Server not found: ${params.server}` }, null, 2),
            },
          ],
          isError: true,
        }
      }

      const servers = loadServers()
      const filtered = servers.filter((s) => s.id !== existing.id && s.host !== existing.host)

      const configPath = getConfigPath()
      fs.writeFileSync(configPath, JSON.stringify({ servers: filtered }, null, 2), 'utf-8')

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ success: true, removed: { id: existing.id, name: existing.name, host: existing.host } }, null, 2),
          },
        ],
      }
    },
  )
}
