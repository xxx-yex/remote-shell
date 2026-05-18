import type { ServerConfig } from '../shared/types'

interface WindowApi {
  getServers(): Promise<ServerConfig[]>
  addServer(server: ServerConfig): Promise<boolean>
  removeServer(id: string): Promise<boolean>
  updateServer(id: string, updates: Partial<ServerConfig>): Promise<boolean>

  getPathForFile(file: File): string

  sshConnect(sessionId: string, config: ServerConfig, cols: number, rows: number): void
  sshInput(sessionId: string, data: string): void
  sshResize(sessionId: string, rows: number, cols: number): void
  sshDisconnect(sessionId: string): void

  sshExec(config: ServerConfig, command: string): Promise<{
    stdout: string
    stderr: string
    exitCode: number
  }>

  sshUpload(config: ServerConfig, localPath: string, remotePath: string, uploadId: string): Promise<void>

  sshDownload(config: ServerConfig, remotePath: string): Promise<boolean>

  clipboardRead(): Promise<string>
  clipboardWrite(text: string): Promise<void>

  onSshReady(callback: (sessionId: string) => void): () => void
  onSshData(callback: (sessionId: string, data: string) => void): () => void
  onSshError(callback: (sessionId: string, error: string) => void): () => void
  onSshClose(callback: (sessionId: string) => void): () => void
  onSshUploadProgress(callback: (uploadId: string, transferred: number, total: number) => void): () => void
}

declare global {
  interface Window {
    api: WindowApi
  }
}
