import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { registerServerList } from './tools/server-list.js'
import { registerServerAdd } from './tools/server-add.js'
import { registerServerRemove } from './tools/server-remove.js'
import { registerSshExec } from './tools/ssh-exec.js'
import { registerSshLs } from './tools/ssh-ls.js'
import { registerSshReadFile } from './tools/ssh-read-file.js'
import { registerSshWriteFile } from './tools/ssh-write-file.js'
import { registerSshUpload } from './tools/ssh-upload.js'
import { registerSshDownload } from './tools/ssh-download.js'
import { registerServerStats } from './tools/server-stats.js'
import { disconnectAll } from '../shared/ssh-client.js'

export async function runMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'remote-shell',
    version: '1.0.0',
  })

  registerServerList(server)
  registerServerAdd(server)
  registerServerRemove(server)
  registerSshExec(server)
  registerSshLs(server)
  registerSshReadFile(server)
  registerSshWriteFile(server)
  registerSshUpload(server)
  registerSshDownload(server)
  registerServerStats(server)

  process.on('SIGINT', () => {
    disconnectAll()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    disconnectAll()
    process.exit(0)
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('remote-shell MCP server running on stdio')
}
