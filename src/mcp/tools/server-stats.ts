import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { findServer } from '../lib/load-config.js'
import { getOrCreateClient } from '../../shared/ssh-client.js'

export function registerServerStats(server: McpServer) {
  server.tool(
    'server_stats',
    'Get system stats (CPU, memory, disk, uptime, load) from a remote server',
    {
      server: z.string().describe('Server ID or hostname'),
    },
    async (params) => {
      const config = findServer(params.server)
      if (!config) {
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

      try {
        const client = await getOrCreateClient(config)
        const stats = await client.getStats()

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  server: config.host,
                  stats,
                },
                null,
                2,
              ),
            },
          ],
        }
      } catch (err: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: err.message || String(err) }, null, 2),
            },
          ],
          isError: true,
        }
      }
    },
  )
}
