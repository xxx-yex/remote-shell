import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { loadServers, getConfigPath } from '../lib/load-config.js'
import type { ServerConfig } from '../../shared/types.js'

export function registerServerAdd(server: McpServer) {
  server.tool(
    'server_add',
    'Add a new remote server to the configuration',
    {
      name: z.string().describe('Friendly name for the server'),
      host: z.string().describe('Hostname or IP address'),
      port: z.number().default(22).describe('SSH port (default 22)'),
      username: z.string().describe('SSH username'),
      authType: z.enum(['password', 'key']).describe('Authentication type'),
      password: z.string().optional().describe('Password (if authType is password)'),
      privateKeyPath: z.string().optional().describe('Path to private key file (if authType is key)'),
      passphrase: z.string().optional().describe('Passphrase for private key'),
      group: z.string().optional().describe('Optional group name'),
    },
    async (params) => {
      const servers = loadServers()

      const newServer: ServerConfig = {
        id: uuidv4(),
        name: params.name,
        host: params.host,
        port: params.port,
        username: params.username,
        authType: params.authType,
        password: params.password,
        privateKeyPath: params.privateKeyPath,
        passphrase: params.passphrase,
        group: params.group,
      }

      servers.push(newServer)

      const configPath = getConfigPath()
      const dir = path.dirname(configPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(configPath, JSON.stringify({ servers }, null, 2), 'utf-8')

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ success: true, id: newServer.id, name: newServer.name }, null, 2),
          },
        ],
      }
    },
  )
}
