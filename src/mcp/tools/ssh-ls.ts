import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { findServer } from '../lib/load-config.js'
import { getOrCreateClient } from '../../shared/ssh-client.js'

export function registerSshLs(server: McpServer) {
  server.tool(
    'ssh_ls',
    'List directory contents on a remote server via SSH',
    {
      server: z.string().describe('Server ID or hostname'),
      path: z.string().default('/').describe('Remote directory path (default /)'),
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
        const entries = await client.listDir(params.path)

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  server: config.host,
                  path: params.path,
                  entries,
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
