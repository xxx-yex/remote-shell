# Quick Start

**[English](./QUICK_START_EN.md) | [中文](./QUICK_START_CN.md)**

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **SSH access** to one or more remote servers

## Installation

```bash
# Clone the repository
git clone https://github.com/xxx-yex/RemoteShell.git
cd RemoteShell

# Install dependencies
npm install
```

## Usage

### Option 1: Desktop GUI

```bash
# Start in development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

After launching, click **"+ Add Server"** in the sidebar to configure your first SSH connection:

1. Enter a friendly **name** (e.g. `prod-web-01`)
2. Enter the server **host** (IP or domain)
3. Set the SSH **port** (default: 22)
4. Enter your **username** (default: root)
5. Choose **authentication type**:
   - **Password** — enter your SSH password
   - **SSH Key** — provide the path to your private key file, with optional passphrase
6. Click **Save**, then click the connect button to open a terminal session

### Option 2: MCP Server (for AI Assistants)

The MCP server allows AI assistants like Claude Code to manage your remote servers.

#### Run directly

```bash
npx tsx src/mcp/cli.ts
```

#### Configure in Claude Code

**Packaged (recommended)**: Download and install from [GitHub Release](https://github.com/xxx-yex/RemoteShell/releases), then point your MCP config to the installed exe:

```json
{
  "mcpServers": {
    "remote-shell": {
      "command": "C:\\Users\\<user>\\AppData\\Local\\Programs\\RemoteShell\\RemoteShell.exe",
      "args": ["--mcp"]
    }
  }
}
```

For the portable version, use the path where you extracted it.

**From source**: Add to your project's `.mcp.json` or global MCP config:

```json
{
  "mcpServers": {
    "remote-shell": {
      "command": "npx",
      "args": ["tsx", "src/mcp/cli.ts"],
      "cwd": "/absolute/path/to/RemoteShell"
    }
  }
}
```

Once configured, the AI assistant can use all 10 SSH tools to manage your servers. Example interactions:

```
> List all my servers
> Add a new server named "staging" at 192.168.1.100 with user deploy
> Check CPU and memory usage on prod-web-01
> Read /etc/nginx/nginx.conf from staging
> Upload ./dist/app.tar.gz to prod-web-01 at /tmp/
```

#### Build MCP server

```bash
npm run mcp:build
# Output: ./dist-mcp/
```

## Configuration File

Server configurations are stored at:

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\remote-shell\config.json` |
| macOS | `~/Library/Application Support/remote-shell/config.json` |
| Linux | `~/.config/remote-shell/config.json` |
| Fallback | `~/.remote-shell/servers.json` |

Example config:

```json
{
  "servers": [
    {
      "id": "a1b2c3d4-...",
      "name": "prod-web-01",
      "host": "192.168.1.50",
      "port": 22,
      "username": "deploy",
      "authType": "key",
      "privateKeyPath": "~/.ssh/id_ed25519",
      "group": "production"
    }
  ],
  "theme": "dark"
}
```

## GUI Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+C` | Copy terminal selection |
| `Ctrl+Shift+V` | Paste to terminal |
| `Tab` | Accept command hint |

## File Manager Features

- **Browse** directories with sortable columns (name, size, type, time)
- **Drag & drop** local files to upload via SFTP
- **Right-click** context menu: download, new file/folder, rename, delete, copy path
- **Path bar** — click to edit, Enter to navigate
- **Terminal sync** — `cd` in terminal auto-syncs the file manager to that path
