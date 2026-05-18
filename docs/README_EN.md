# RemoteShell

A cross-platform SSH remote server manager with desktop GUI and MCP Server.

> **v1** — The built-in AI assistant module for the GUI will be added in a future release. Currently, AI capabilities are available through MCP protocol via external tools (e.g. Claude Code).

Manage servers, execute commands, transfer files, and monitor system stats — standalone or integrated with AI tools via Model Context Protocol.

## Features

### Desktop GUI (Electron)

- **Multi-tab Terminal** — Connect to multiple servers simultaneously with xterm.js powered terminals, Catppuccin dark theme, JetBrains Mono font
- **Server Management** — Add, edit, delete servers with password or SSH key authentication, organized by groups
- **Remote File Manager** — Browse, upload, download, create, rename, and delete files via SFTP with drag-and-drop support
- **Command Hints** — 200+ built-in Linux command auto-suggestions with Tab completion
- **Command Log** — Track all executed commands with timestamps, one-click copy to clipboard
- **System Monitor** — Real-time CPU, memory, disk, uptime, and load average monitoring
- **Frameless Window** — Clean modern UI with custom titlebar, single-instance lock

### MCP Server

Expose all SSH operations as AI tools, enabling Claude Code and other MCP-compatible AI assistants to manage your remote servers directly:

| Tool | Description |
|------|-------------|
| `server_list` | List all saved remote servers (passwords masked) |
| `server_add` | Add a new server to configuration |
| `server_remove` | Remove a server from configuration |
| `server_stats` | Get CPU, memory, disk, uptime, load stats |
| `ssh_exec` | Execute a command on a remote server |
| `ssh_ls` | List directory contents on a remote server |
| `ssh_read_file` | Read a file from a remote server |
| `ssh_write_file` | Write content to a file on a remote server |
| `ssh_upload` | Upload a local file to a remote server (SFTP) |
| `ssh_download` | Download a remote file to local (SFTP) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Electron 35 + electron-vite 3 |
| Frontend | React 19 + TypeScript 5.7 |
| Terminal | xterm.js 5.3 |
| SSH | ssh2 1.16 |
| AI Protocol | @modelcontextprotocol/sdk 1.12 |
| Validation | Zod 3.24 |
| Storage | electron-store 8.2 |

## Quick Start

See [QUICK_START_EN.md](./QUICK_START_EN.md) for detailed setup and usage instructions.

## License

MIT
