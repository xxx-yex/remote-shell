import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { findServer } from '../lib/load-config.js'
import { getOrCreateClient } from '../../shared/ssh-client.js'

export function registerSshExec(server: McpServer) {
  server.tool(
    'ssh_exec',
    'Execute a command on a remote server via SSH',
    {
      server: z.string().describe('Server ID or hostname'),
      command: z.string().describe('Command to execute'),
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
        const result = await client.exec(params.command)

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  server: config.host,
                  command: params.command,
                  stdout: result.stdout,
                  stderr: result.stderr,
                  exitCode: result.exitCode,
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
