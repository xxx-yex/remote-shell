import { useState, useEffect } from 'react'
import type { ServerConfig } from '../../shared/types'
import type { CmdLogEntry } from '../App'

interface Props {
  onConnect: (server: ServerConfig) => void
  cmdLog: CmdLogEntry[]
  onClearLog: () => void
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export default function Sidebar({ onConnect, cmdLog, onClearLog }: Props) {
  const [servers, setServers] = useState<ServerConfig[]>([])
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(true)

  useEffect(() => {
    window.api.getServers().then(setServers)
  }, [])

  const refreshServers = () => window.api.getServers().then(setServers)

  const handleAdd = async (server: ServerConfig) => {
    await window.api.addServer(server)
    setShowForm(false)
    refreshServers()
  }

  const handleRemove = async (id: string) => {
    await window.api.removeServer(id)
    setConfirmDelete(null)
    refreshServers()
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">服务器</span>
        <button className="sidebar-add-btn" onClick={() => setShowForm(true)} title="添加服务器">+</button>
      </div>

      <div className="sidebar-servers">
        {servers.length === 0 ? (
          <div className="sidebar-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="1.3" />
              <rect x="2" y="14" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="6" cy="6" r="1" fill="currentColor" />
              <circle cx="6" cy="18" r="1" fill="currentColor" />
            </svg>
            <span>暂无服务器，点击 + 添加</span>
          </div>
        ) : (
          servers.map((s) => (
            <div key={s.id} className="server-group">
              <div className="server-item">
                <span className="server-dot" />
                <div className="server-info" onClick={() => onConnect(s)}>
                  <span className="server-name">{s.name}</span>
                  <span className="server-host">{s.username}@{s.host}:{s.port}</span>
                </div>
                <div className="server-item-actions">
                  <button className="server-action-btn" title="连接终端" onClick={(e) => { e.stopPropagation(); onConnect(s) }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </button>
                  <button className="server-action-btn" title="删除" onClick={(e) => { e.stopPropagation(); setConfirmDelete(s.id) }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Command Log */}
      <div className="cmdlog-section">
        <div className="cmdlog-header" onClick={() => setShowLog(!showLog)}>
          <svg className={`tree-chevron ${showLog ? 'expanded' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="cmdlog-title">命令日志</span>
          <span className="cmdlog-count">{cmdLog.length > 0 ? cmdLog.length : ''}</span>
          {cmdLog.length > 0 && (
            <button className="cmdlog-clear" onClick={(e) => { e.stopPropagation(); onClearLog() }} title="清空">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v12a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          )}
        </div>
        {showLog && (
          <div className="cmdlog-list">
            {cmdLog.length === 0 ? (
              <div className="cmdlog-empty">暂无命令记录</div>
            ) : (
              cmdLog.map((entry) => (
                <div
                  key={entry.id}
                  className="cmdlog-item"
                  onClick={() => window.api.clipboardWrite(entry.command)}
                  title={`点击复制: ${entry.command}`}
                >
                  <div className="cmdlog-item-meta">
                    <span className="cmdlog-item-time">{formatTime(entry.time)}</span>
                    <span className="cmdlog-item-server">{entry.serverName}</span>
                  </div>
                  <div className="cmdlog-item-cmd">{entry.command}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showForm && <ServerForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">确认删除服务器？</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: 16 }}>该操作不可撤销，服务器配置将被永久移除。</p>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>取消</button>
              <button className="btn btn-danger" onClick={() => handleRemove(confirmDelete)}>删除</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

function ServerForm({ onSubmit, onCancel }: { onSubmit: (s: ServerConfig) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('root')
  const [authType, setAuthType] = useState<'password' | 'key'>('password')
  const [password, setPassword] = useState('')
  const [privateKeyPath, setPrivateKeyPath] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      id: crypto.randomUUID(),
      name: name || host,
      host,
      port: parseInt(port, 10) || 22,
      username,
      authType,
      password: authType === 'password' ? password : undefined,
      privateKeyPath: authType === 'key' ? privateKeyPath : undefined,
    })
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-title">添加服务器</div>
          <div className="form-group">
            <label className="form-label">名称</label>
            <input className="form-input" placeholder="My Server" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">主机</label>
              <input className="form-input" placeholder="192.168.1.1" value={host} onChange={(e) => setHost(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">端口</label>
              <input className="form-input" type="number" value={port} onChange={(e) => setPort(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">用户名</label>
            <input className="form-input" placeholder="root" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">认证方式</label>
            <select className="form-select" value={authType} onChange={(e) => setAuthType(e.target.value as any)}>
              <option value="password">密码</option>
              <option value="key">SSH 密钥</option>
            </select>
          </div>
          {authType === 'password' ? (
            <div className="form-group">
              <label className="form-label">密码</label>
              <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">密钥路径</label>
              <input className="form-input" placeholder="~/.ssh/id_rsa" value={privateKeyPath} onChange={(e) => setPrivateKeyPath(e.target.value)} />
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>取消</button>
            <button type="submit" className="btn btn-primary">添加</button>
          </div>
        </form>
      </div>
    </div>
  )
}
