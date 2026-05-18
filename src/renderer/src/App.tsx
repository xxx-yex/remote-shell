import { useState, useCallback } from 'react'
import type { ServerConfig } from '../../shared/types'
import Sidebar from './components/Sidebar'
import TerminalTabs from './components/TerminalTabs'

export interface TerminalTab {
  id: string
  server: ServerConfig
  status: 'connecting' | 'connected' | 'error' | 'closed'
}

export interface CmdLogEntry {
  id: string
  command: string
  time: number
  serverName: string
}

export default function App() {
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [cmdLog, setCmdLog] = useState<CmdLogEntry[]>([])

  const handleConnect = useCallback((server: ServerConfig) => {
    const id = `${server.id}-${Date.now()}`
    const tab: TerminalTab = { id, server, status: 'connecting' }
    setTabs((prev) => [...prev, tab])
    setActiveTabId(id)
  }, [])

  const handleTabStatus = useCallback((tabId: string, status: TerminalTab['status']) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, status } : t)))
  }, [])

  const handleCloseTab = useCallback((tabId: string) => {
    window.api.sshDisconnect(tabId)
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId)
      if (tabId === activeTabId && next.length > 0) {
        setActiveTabId(next[next.length - 1].id)
      } else if (next.length === 0) {
        setActiveTabId(null)
      }
      return next
    })
  }, [activeTabId])

  const handleCommand = useCallback((serverName: string, command: string) => {
    if (!command.trim()) return
    const entry: CmdLogEntry = {
      id: crypto.randomUUID(),
      command: command.trim(),
      time: Date.now(),
      serverName,
    }
    setCmdLog((prev) => [entry, ...prev].slice(0, 200))
  }, [])

  return (
    <div className="app-layout">
      <div className="titlebar">
        <div className="titlebar-drag">
          <span className="titlebar-title">Remote Shell</span>
        </div>
        <div className="titlebar-controls">
          <button className="titlebar-btn" onClick={() => window.api.windowMinimize()}>
            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 6h10" stroke="currentColor" strokeWidth="1.2" /></svg>
          </button>
          <button className="titlebar-btn" onClick={() => window.api.windowMaximize()}>
            <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" stroke="currentColor" strokeWidth="1.2" fill="none" /></svg>
          </button>
          <button className="titlebar-btn titlebar-btn-close" onClick={() => window.api.windowClose()}>
            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.2" /></svg>
          </button>
        </div>
      </div>
      <div className="app-body">
        <Sidebar onConnect={handleConnect} cmdLog={cmdLog} onClearLog={() => setCmdLog([])} />
        <TerminalTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onSelect={setActiveTabId}
          onClose={handleCloseTab}
          onStatusChange={handleTabStatus}
          onCommand={handleCommand}
        />
      </div>
    </div>
  )
}
