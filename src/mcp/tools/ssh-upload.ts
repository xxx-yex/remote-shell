import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { findServer } from '../lib/load-config.js'
import { getOrCreateClient } from '../../shared/ssh-client.js'

export function registerSshUpload(server: McpServer) {
  server.tool(
    'ssh_upload',
    'Upload a local file to a remote server via SSH/SFTP',
    {
      server: z.string().describe('Server ID or hostname'),
      localPath: z.string().describe('Local file path to upload'),
      remotePath: z.string().describe('Remote destination file path'),
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
        await client.upload(params.localPath, params.remotePath)

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  server: config.host,
                  localPath: params.localPath,
                  remotePath: params.remotePath,
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
