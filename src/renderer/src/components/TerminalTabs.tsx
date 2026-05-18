import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import type { TerminalTab, CmdLogEntry } from '../App'
import FileTreePanel from './FileTreePanel'

interface Props {
  tabs: TerminalTab[]
  activeTabId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onStatusChange: (tabId: string, status: TerminalTab['status']) => void
  onCommand: (serverName: string, command: string) => void
}

const termInstances = new Map<string, { term: Terminal; fit: FitAddon; container: HTMLDivElement; errorMsg?: string }>()

const ANSI_RE = /\x1b\[[0-9;]*m/

const COMMON_CMDS = [
  'cd', 'ls', 'pwd', 'pushd', 'popd', 'dirs',
  'cp', 'mv', 'rm', 'mkdir', 'rmdir', 'touch', 'ln', 'chmod', 'chown', 'chgrp',
  'cat', 'less', 'more', 'head', 'tail', 'tac', 'nl', 'od', 'bat',
  'find', 'locate', 'which', 'whereis', 'file', 'stat', 'du', 'df',
  'grep', 'egrep', 'fgrep', 'sed', 'awk', 'sort', 'uniq', 'wc', 'cut', 'tr', 'tee', 'diff', 'patch',
  'tar', 'gzip', 'gunzip', 'bzip2', 'xz', 'zip', 'unzip',
  'echo', 'printf', 'yes', 'seq', 'read',
  'ps', 'top', 'htop', 'kill', 'killall', 'pkill', 'jobs', 'bg', 'fg', 'nohup',
  'nice', 'renice', 'sleep', 'wait', 'crontab', 'at', 'watch',
  'uname', 'hostname', 'whoami', 'id', 'date', 'cal', 'uptime', 'free', 'lscpu',
  'su', 'sudo', 'exit', 'logout', 'reboot', 'shutdown', 'poweroff', 'halt',
  'man', 'info', 'help', 'history', 'alias', 'unalias', 'export', 'source',
  'env', 'printenv', 'set', 'unset', 'type', 'command', 'basename', 'dirname', 'realpath',
  'systemctl', 'service', 'journalctl', 'chkconfig',
  'mount', 'umount', 'fdisk', 'mkfs', 'fsck', 'blkid', 'lsblk', 'parted',
  'ping', 'traceroute', 'tracepath', 'curl', 'wget',
  'ifconfig', 'ip', 'netstat', 'ss', 'nslookup', 'dig', 'host', 'arp', 'route',
  'ssh', 'scp', 'sftp', 'rsync',
  'iptables', 'firewall-cmd', 'ufw',
  'yum', 'dnf', 'apt', 'apt-get', 'rpm', 'dpkg', 'pip', 'npm', 'npx', 'yarn', 'pnpm',
  'vi', 'vim', 'nano', 'emacs', 'code',
  'bash', 'sh', 'zsh', 'dash',
  'clear', 'reset', 'tput', 'stty', 'screen', 'tmux',
  'base64', 'md5sum', 'sha256sum', 'sha1sum', 'openssl',
  'lsof', 'strace', 'ltrace', 'gdb', 'perf', 'iotop', 'ncdu',
  'dd', 'mktemp', 'install', 'chroot', 'xargs',
  'tree', 'jq', 'yq', 'awk', 'column', 'paste', 'expand', 'fmt', 'fold',
  'docker', 'docker-compose', 'podman', 'kubectl', 'helm',
  'git', 'make', 'cmake', 'gcc', 'g++', 'java', 'javac', 'python', 'python3', 'node', 'go', 'rustc', 'cargo',
  'nc', 'socat', 'nmap', 'tcpdump', 'wireshark', 'tshark',
  'passwd', 'useradd', 'userdel', 'usermod', 'groupadd', 'groupdel', 'groups', 'chage',
  'dmesg', 'lsmod', 'modprobe', 'insmod', 'rmmod', 'lspci', 'lsusb',
  'vmstat', 'mpstat', 'iostat', 'sar', 'nmon',
  'test', 'expr', 'let', 'bc', 'awk',
  'traps', 'seq', 'shuf', 'split', 'csplit', 'rev', 'tac', 'comm', 'join', 'tsort',
]

function getCmdHints(word: string): string[] {
  if (word.length < 1) return []
  const lower = word.toLowerCase()
  return COMMON_CMDS.filter(c => c.startsWith(lower) && c !== lower).slice(0, 10)
}

function colorize(data: string): string {
  if (ANSI_RE.test(data)) return data

  return data
    .replace(/^(\d+):\s+([a-zA-Z][a-zA-Z0-9._-]*):/gm, '\x1b[1;36m$1\x1b[0m:\x1b[1;33m$2\x1b[0m:')
    .replace(/<([^>]+)>/g, '\x1b[2;36m<$1>\x1b[0m')
    .replace(/\bstate\s+(UP|DOWN|UNKNOWN|DORMANT)\b/gi, (_, v) => {
      const c = v.toUpperCase() === 'UP' ? 32 : v.toUpperCase() === 'DOWN' ? 31 : 33
      return `state \x1b[1;${c}m${v}\x1b[0m`
    })
    .replace(/\b(inet6?)\s+([0-9a-fA-F:.\/]+)/g, '\x1b[34m$1\x1b[0m \x1b[32m$2\x1b[0m')
    .replace(/\b(link\/\w+)\s+([0-9a-fA-F:]{17})/g, '\x1b[2m$1\x1b[0m \x1b[33m$2\x1b[0m')
    .replace(/\bmtu\s+(\d+)/g, 'mtu \x1b[2;37m$1\x1b[0m')
    .replace(/\bscope\s+(\w+)/g, 'scope \x1b[35m$1\x1b[0m')
    .replace(/\bbrd\s+([0-9a-fA-F:.]+)/g, 'brd \x1b[2;37m$1\x1b[0m')
}

function getCurrentWord(buf: string): string {
  const m = buf.match(/([a-zA-Z0-9_.\-]+)$/)
  return m ? m[1] : ''
}

export interface CmdHint {
  word: string
  matches: string[]
}

export default function TerminalTabs({ tabs, activeTabId, onSelect, onClose, onStatusChange, onCommand }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [syncPath, setSyncPath] = useState<string | null>(null)
  const [cmdHints, setCmdHints] = useState<CmdHint | null>(null)

  const hideCtxMenu = useCallback(() => setCtxMenu(null), [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    while (viewport.firstChild) viewport.removeChild(viewport.firstChild)

    if (activeTabId) {
      const inst = termInstances.get(activeTabId)
      if (inst) {
        inst.container.style.display = 'block'
        viewport.appendChild(inst.container)
        requestAnimationFrame(() => inst.fit.fit())
      }
    }
  }, [activeTabId, tabs])

  // Refit terminal when viewport resizes (file panel drag, window resize, etc.)
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    let raf = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (activeTabId) {
          const inst = termInstances.get(activeTabId)
          if (inst) inst.fit.fit()
        }
      })
    })
    observer.observe(vp)
    return () => { observer.disconnect(); cancelAnimationFrame(raf) }
  }, [activeTabId])

  // Context menu on the terminal viewport
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return

    const onCtx = (e: MouseEvent) => {
      e.preventDefault()
      setCtxMenu({ x: e.clientX, y: e.clientY })
    }

    vp.addEventListener('contextmenu', onCtx)
    return () => vp.removeEventListener('contextmenu', onCtx)
  }, [])

  // Close context menu on click outside
  useEffect(() => {
    if (!ctxMenu) return
    const onClick = () => hideCtxMenu()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hideCtxMenu() }
    window.addEventListener('click', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [ctxMenu, hideCtxMenu])

  // Clear hints when switching tabs
  useEffect(() => {
    setCmdHints(null)
  }, [activeTabId])

  const handleCopy = useCallback(() => {
    if (!activeTabId) return
    const inst = termInstances.get(activeTabId)
    if (inst) {
      const sel = inst.term.getSelection()
      if (sel) window.api.clipboardWrite(sel)
    }
    hideCtxMenu()
  }, [activeTabId, hideCtxMenu])

  const handlePaste = useCallback(async () => {
    if (!activeTabId) return
    const inst = termInstances.get(activeTabId)
    if (inst) {
      const text = await window.api.clipboardRead()
      if (text) inst.term.paste(text)
    }
    hideCtxMenu()
  }, [activeTabId, hideCtxMenu])

  const handleSelectAll = useCallback(() => {
    if (!activeTabId) return
    const inst = termInstances.get(activeTabId)
    if (inst) inst.term.selectAll()
    hideCtxMenu()
  }, [activeTabId, hideCtxMenu])

  const handleClear = useCallback(() => {
    if (!activeTabId) return
    const inst = termInstances.get(activeTabId)
    if (inst) inst.term.clear()
    hideCtxMenu()
  }, [activeTabId, hideCtxMenu])

  const hasSelection = activeTabId ? !!(termInstances.get(activeTabId)?.term.getSelection()) : false

  const activeTab = tabs.find(t => t.id === activeTabId)
  const activeServer = activeTab?.status === 'connected' ? activeTab.server : null

  return (
    <div className="main-area">
      <div className="tab-bar">
        {tabs.map((tab) => {
          const inst = termInstances.get(tab.id)
          const errMsg = tab.status === 'error' ? inst?.errorMsg : undefined
          return (
            <div
              key={tab.id}
              className={`tab-item ${tab.id === activeTabId ? 'active' : ''}`}
              onClick={() => onSelect(tab.id)}
              title={errMsg || undefined}
            >
              <span className={`tab-status-dot ${tab.status}`} />
              <span className="tab-name">{tab.server.name || tab.server.host}</span>
              {tab.status === 'connecting' && <span className="tab-hint">连接中...</span>}
              {errMsg && <span className="tab-err">失败</span>}
              <button className="tab-close" onClick={(e) => { e.stopPropagation(); onClose(tab.id) }}>
                ×
              </button>
            </div>
          )
        })}
      </div>

      <div className="terminal-viewport" ref={viewportRef} />

      {activeTabId && (() => {
        const active = tabs.find(t => t.id === activeTabId)
        if (!active) return null
        const inst = termInstances.get(activeTabId)
        if (active.status === 'connecting') {
          return (
            <div className="status-overlay">
              <div className="status-spinner" />
              <p>正在连接 {active.server.host}...</p>
            </div>
          )
        }
        if (active.status === 'error') {
          return (
            <div className="status-overlay">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 12 }}>
                <circle cx="12" cy="12" r="10" stroke="var(--red)" strokeWidth="1.5" />
                <path d="M8 8l8 8M16 8l-8 8" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="status-error-title">连接失败</p>
              <p className="status-error-msg">{inst?.errorMsg || '未知错误'}</p>
            </div>
          )
        }
        return null
      })()}

      {tabs.length === 0 && (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="3" width="20" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 10l3 3-3 3M13 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p>选择服务器连接以开始</p>
        </div>
      )}

      {tabs.map((tab) => (
        <TerminalCreator key={tab.id} tab={tab} onStatusChange={onStatusChange} onCd={setSyncPath} onHints={setCmdHints} onCommand={onCommand} />
      ))}

      {/* Command hints */}
      {cmdHints && cmdHints.matches.length > 0 && activeTabId && tabs.find(t => t.id === activeTabId)?.status === 'connected' && (
        <div className="cmd-hint-bar">
          {cmdHints.matches.map((m) => (
            <span key={m} className="cmd-hint-chip">
              <span className="cmd-hint-match">{m.slice(0, cmdHints.word.length)}</span>
              <span className="cmd-hint-rest">{m.slice(cmdHints.word.length)}</span>
            </span>
          ))}
          <span className="cmd-hint-tab">Tab 补全</span>
        </div>
      )}

      {activeTabId && tabs.find(t => t.id === activeTabId)?.status === 'connected' && (
        <div className="hint-bar">
          <span className="hint-item"><kbd>Ctrl+Shift+C</kbd> 复制</span>
          <span className="hint-sep">|</span>
          <span className="hint-item"><kbd>Ctrl+Shift+V</kbd> 粘贴</span>
          <span className="hint-sep">|</span>
          <span className="hint-item"><kbd>Tab</kbd> 命令补全</span>
          <span className="hint-sep">|</span>
          <span className="hint-item">右键 更多操作</span>
        </div>
      )}

      {ctxMenu && (
        <div
          className="ctx-menu"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className={`ctx-item ${!hasSelection ? 'disabled' : ''}`} onClick={handleCopy} disabled={!hasSelection}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5"/></svg>
            复制
            <span className="ctx-shortcut">Ctrl+Shift+C</span>
          </button>
          <button className="ctx-item" onClick={handlePaste}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" stroke="currentColor" strokeWidth="1.5"/><rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
            粘贴
            <span className="ctx-shortcut">Ctrl+Shift+V</span>
          </button>
          <div className="ctx-divider" />
          <button className="ctx-item" onClick={handleSelectAll}>
            全选
          </button>
          <button className="ctx-item" onClick={handleClear}>
            清屏
          </button>
        </div>
      )}

      <FileTreePanel server={activeServer} syncPath={syncPath} onPathChange={() => setSyncPath(null)} />
    </div>
  )
}

function TerminalCreator({ tab, onStatusChange, onCd, onHints, onCommand }: {
  tab: TerminalTab
  onStatusChange: (id: string, status: TerminalTab['status']) => void
  onCd: (path: string) => void
  onHints: (hints: CmdHint | null) => void
  onCommand: (serverName: string, command: string) => void
}) {
  const created = useRef(false)

  useEffect(() => {
    if (created.current) return
    created.current = true

    const viewport = document.querySelector('.terminal-viewport') as HTMLElement
    if (!viewport) return

    const container = document.createElement('div')
    container.className = 'terminal-wrapper'
    container.style.display = 'none'

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "JetBrains Mono, Cascadia Code, Fira Code, monospace",
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#3F51B5',
        selectionBackground: 'rgba(63,81,181,0.25)',
        black: '#45475a',
        red: '#e53935',
        green: '#4caf50',
        yellow: '#ff9800',
        blue: '#3F51B5',
        magenta: '#757de8',
        cyan: '#2196F3',
        white: '#cdd6f4',
        brightBlack: '#585b70',
        brightRed: '#e57373',
        brightGreen: '#81c784',
        brightYellow: '#ffb74d',
        brightBlue: '#5c6bc0',
        brightMagenta: '#9fa8da',
        brightCyan: '#64b5f6',
        brightWhite: '#ffffff',
      },
    })

    const fit = new FitAddon()
    term.loadAddon(fit)

    viewport.appendChild(container)
    container.style.display = 'block'
    term.open(container)
    fit.fit()

    const cols = term.cols
    const rows = term.rows

    container.style.display = 'none'
    termInstances.set(tab.id, { term, fit, container })

    // Hint state in closure — shared between key handler and data handler
    let currentHints: CmdHint | null = null

    const updateHints = (buf: string) => {
      const word = getCurrentWord(buf)
      if (word.length >= 1) {
        const matches = getCmdHints(word)
        currentHints = matches.length > 0 ? { word, matches } : null
      } else {
        currentHints = null
      }
      onHints(currentHints)
    }

    // Keyboard shortcuts + Tab completion
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true

      // Tab — always prevent focus change
      if (event.key === 'Tab' && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        if (currentHints && currentHints.matches.length > 0) {
          const completion = currentHints.matches[0].slice(currentHints.word.length)
          if (completion) {
            window.api.sshInput(tab.id, completion)
            inputBuffer += completion
            currentHints = null
            onHints(null)
          }
          return false
        }
      }

      if (event.ctrlKey && event.shiftKey && (event.key === 'C' || event.key === 'c')) {
        const sel = term.getSelection()
        if (sel) window.api.clipboardWrite(sel)
        return false
      }
      if (event.ctrlKey && event.shiftKey && (event.key === 'V' || event.key === 'v')) {
        window.api.clipboardRead().then(text => { if (text) term.paste(text) })
        return false
      }
      return true
    })

    let inputBuffer = ''

    term.onData((data) => {
      window.api.sshInput(tab.id, data)

      if (data === '\r' || data === '\n') {
        const cmd = inputBuffer.trim()
        if (cmd) {
          onCommand(tab.server.name || tab.server.host, cmd)
        }
        const cdMatch = cmd.match(/^cd\s+(.+)$/)
        if (cdMatch) {
          const rawPath = cdMatch[1].replace(/^["']|["']$/g, '').trim()
          if (rawPath) {
            const resolved = rawPath.startsWith('/') ? rawPath
              : rawPath === '~' ? '/root'
              : rawPath.startsWith('~/') ? `/root/${rawPath.slice(2)}`
              : rawPath
            onCd(resolved)
          }
        }
        inputBuffer = ''
        currentHints = null
        onHints(null)
      } else if (data === '\x7f' || data === '\b') {
        inputBuffer = inputBuffer.slice(0, -1)
        updateHints(inputBuffer)
      } else if (data === '\x03' || data === '\x15') {
        inputBuffer = ''
        currentHints = null
        onHints(null)
      } else if (data === '\t') {
        // Tab already handled in key handler, skip
      } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
        inputBuffer += data
        updateHints(inputBuffer)
      } else {
        // Arrow keys, escape sequences, etc — don't update buffer
      }
    })

    term.onResize(({ cols, rows }) => {
      window.api.sshResize(tab.id, rows, cols)
    })

    window.api.sshConnect(tab.id, tab.server, cols, rows)

    let connected = false

    const timeoutId = setTimeout(() => {
      if (connected) return
      onStatusChange(tab.id, 'error')
      const inst = termInstances.get(tab.id)
      if (inst) {
        inst.errorMsg = `连接超时：${tab.server.host} 未在 5 秒内响应`
        inst.term.write(`\r\n\x1b[31m✖ 连接超时：${tab.server.host} 未在 5 秒内响应，请检查服务器地址和网络\x1b[0m\r\n`)
      }
    }, 5000)

    const offReady = window.api.onSshReady((sessionId) => {
      if (sessionId === tab.id) {
        connected = true
        clearTimeout(timeoutId)
        onStatusChange(tab.id, 'connected')
      }
    })
    const offData = window.api.onSshData((sessionId, data) => {
      if (sessionId === tab.id) {
        const inst = termInstances.get(tab.id)
        if (inst) inst.term.write(colorize(data))
      }
    })
    const offError = window.api.onSshError((sessionId, error) => {
      if (sessionId === tab.id) {
        clearTimeout(timeoutId)
        onStatusChange(tab.id, 'error')
        const inst = termInstances.get(tab.id)
        if (inst) {
          inst.errorMsg = error
          inst.term.write(`\r\n\x1b[31m✖ ${error}\x1b[0m\r\n`)
        }
      }
    })
    const offClose = window.api.onSshClose((sessionId) => {
      if (sessionId === tab.id) {
        clearTimeout(timeoutId)
        onStatusChange(tab.id, 'closed')
        const inst = termInstances.get(tab.id)
        if (inst) inst.term.write('\r\n\x1b[33m--- Connection closed ---\x1b[0m\r\n')
      }
    })

    ;(container as any)._cleanup = () => {
      clearTimeout(timeoutId)
      offReady()
      offData()
      offError()
      offClose()
    }
  }, [tab.id, tab.server, onStatusChange])

  useEffect(() => {
    return () => {
      const inst = termInstances.get(tab.id)
      if (inst) {
        if ((inst.container as any)._cleanup) (inst.container as any)._cleanup()
        inst.term.dispose()
        inst.container.remove()
        termInstances.delete(tab.id)
      }
    }
  }, [tab.id])

  return null
}
