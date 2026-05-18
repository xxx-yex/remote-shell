# RemoteShell

跨平台 SSH 远程服务器管理工具，集成桌面客户端和 MCP Server。

> **v1** — GUI 内嵌 AI 助理模块将在后续版本加入，当前 AI 能力通过 MCP 协议由外部工具调用。

管理服务器、执行命令、传输文件、监控系统状态 — 可独立使用，也可通过 MCP 协议接入 AI 工具。

## 功能特性

### 桌面客户端 (Electron)

- **多标签终端** — 基于 xterm.js 的多服务器同时连接，Catppuccin 暗色主题，JetBrains Mono 等宽字体
- **服务器管理** — 添加、编辑、删除服务器，支持密码和 SSH 密钥认证，支持分组管理
- **远程文件管理器** — 通过 SFTP 浏览、上传、下载、新建、重命名和删除文件，支持拖拽上传
- **命令提示** — 内置 200+ 常用 Linux 命令自动补全，Tab 键快速确认
- **命令日志** — 记录所有执行过的命令及时间戳，点击即可复制到剪贴板
- **系统监控** — 实时查看 CPU、内存、磁盘、运行时间和负载情况
- **无边框窗口** — 现代简洁 UI，自定义标题栏，单实例锁定

### MCP Server

将所有 SSH 操作暴露为 AI 工具，支持 MCP 协议的 AI 助手直接管理你的远程服务器：

| 工具 | 说明 |
|------|------|
| `server_list` | 列出所有已保存的远程服务器（密码已脱敏） |
| `server_add` | 添加新的服务器配置 |
| `server_remove` | 移除服务器配置 |
| `server_stats` | 获取 CPU、内存、磁盘、运行时间、负载等系统信息 |
| `ssh_exec` | 在远程服务器上执行命令 |
| `ssh_ls` | 列出远程服务器上的目录内容 |
| `ssh_read_file` | 读取远程服务器上的文件 |
| `ssh_write_file` | 写入内容到远程服务器上的文件 |
| `ssh_upload` | 上传本地文件到远程服务器（SFTP） |
| `ssh_download` | 下载远程文件到本地（SFTP） |

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Electron 35 + electron-vite 3 |
| 前端 | React 19 + TypeScript 5.7 |
| 终端 | xterm.js 5.3 |
| SSH | ssh2 1.16 |
| AI 协议 | @modelcontextprotocol/sdk 1.12 |
| 校验 | Zod 3.24 |
| 存储 | electron-store 8.2 |

## 快速开始

详细安装和使用说明请参阅 [快速开始文档](./docs/QUICK_START_CN.md)（[English](./docs/QUICK_START_EN.md)）。

## 许可证

MIT
