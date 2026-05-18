import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { findServer } from '../lib/load-config.js'
import { getOrCreateClient } from '../../shared/ssh-client.js'

export function registerSshReadFile(server: McpServer) {
  server.tool(
    'ssh_read_file',
    'Read a file from a remote server via SSH',
    {
      server: z.string().describe('Server ID or hostname'),
      path: z.string().describe('Remote file path to read'),
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
        const content = await client.readFile(params.path)

        return {
          content: [
            {
              type: 'text' as const,
              text: content,
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
