import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { findServer } from '../lib/load-config.js'
import { getOrCreateClient } from '../../shared/ssh-client.js'

export function registerSshDownload(server: McpServer) {
  server.tool(
    'ssh_download',
    'Download a remote file from a server via SSH/SFTP',
    {
      server: z.string().describe('Server ID or hostname'),
      remotePath: z.string().describe('Remote file path to download'),
      localPath: z.string().describe('Local destination file path'),
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
        await client.download(params.remotePath, params.localPath)

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  server: config.host,
                  remotePath: params.remotePath,
                  localPath: params.localPath,
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
