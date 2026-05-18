# 快速开始

**[English](./QUICK_START_EN.md) | [中文](./QUICK_START_CN.md)**

## 环境要求

- **Node.js** >= 18
- **npm** >= 9
- 可通过 SSH 访问一台或多台远程服务器

## 安装

```bash
# 克隆仓库
git clone https://github.com/xxx-yex/RemoteShell.git
cd RemoteShell

# 安装依赖
npm install
```

## 使用方式

### 方式一：桌面客户端

```bash
# 开发模式启动
npm run dev

# 生产环境构建
npm run build

# 预览生产构建
npm run preview
```

启动后，点击侧边栏的 **"+ 添加服务器"** 配置你的第一个 SSH 连接：

1. 填写服务器 **名称**（如 `prod-web-01`）
2. 填写服务器 **地址**（IP 或域名）
3. 设置 SSH **端口**（默认：22）
4. 填写 **用户名**（默认：root）
5. 选择 **认证方式**：
   - **密码认证** — 填写 SSH 密码
   - **密钥认证** — 填写私钥文件路径，可选括密码短语
6. 点击 **保存**，然后点击连接按钮打开终端会话

### 方式二：MCP Server（接入 AI 助手）

MCP Server 让 Claude Code 等 AI 助手可以直接管理你的远程服务器。

#### 直接运行

```bash
npx tsx src/mcp/cli.ts
```

#### 在 Claude Code 中配置

**打包版（推荐）**：下载 [GitHub Release](https://github.com/xxx-yex/RemoteShell/releases) 安装后，MCP 配置指向安装目录的 exe：

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

便携版用户使用对应的解压路径即可。

**开发版**：从源码运行，在项目的 `.mcp.json` 或全局 MCP 配置中添加：

```json
{
  "mcpServers": {
    "remote-shell": {
      "command": "npx",
      "args": ["tsx", "src/mcp/cli.ts"],
      "cwd": "/RemoteShell 的绝对路径"
    }
  }
}
```

配置完成后，AI 助手即可使用全部 10 个 SSH 工具管理你的服务器。示例对话：

```
> 列出我所有的服务器
> 添加一台名为 "staging" 的服务器，地址 192.168.1.100，用户 deploy
> 查看 prod-web-01 的 CPU 和内存使用情况
> 读取 staging 上的 /etc/nginx/nginx.conf
> 上传 ./dist/app.tar.gz 到 prod-web-01 的 /tmp/ 目录
```

#### 构建 MCP Server

```bash
npm run mcp:build
# 输出目录：./dist-mcp/
```

## 配置文件

服务器配置文件存储位置：

| 平台 | 路径 |
|------|------|
| Windows | `%APPDATA%\remote-shell\config.json` |
| macOS | `~/Library/Application Support/remote-shell/config.json` |
| Linux | `~/.config/remote-shell/config.json` |
| 备用路径 | `~/.remote-shell/servers.json` |

配置示例：

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

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+C` | 复制终端选中内容 |
| `Ctrl+Shift+V` | 粘贴到终端 |
| `Tab` | 确认命令提示补全 |

## 文件管理器功能

- **浏览目录** — 支持按名称、大小、类型、时间排序
- **拖拽上传** — 将本地文件拖入面板即可通过 SFTP 上传
- **右键菜单** — 下载、新建文件/文件夹、重命名、删除、复制路径
- **路径栏** — 点击可编辑，回车跳转
- **终端同步** — 在终端中 `cd` 后文件管理器自动同步到对应路径
