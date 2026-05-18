import { useState, useEffect, useCallback } from 'react'
import type { ServerConfig, DirectoryEntry } from '../../shared/types'

interface Props {
  server: ServerConfig
  onClose: () => void
}

export default function FileManager({ server, onClose }: Props) {
  const [path, setPath] = useState('/')
  const [entries, setEntries] = useState<DirectoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDir = useCallback(async (dirPath: string) => {
    setLoading(true)
    setError('')
    setPath(dirPath)

    try {
      const result = await window.api.sshExec(
        server,
        `ls -la --time-style=full-iso "${dirPath}" 2>&1`,
      )

      if (result.exitCode !== 0) {
        setError(result.stderr || 'Failed to list directory')
        setEntries([])
        return
      }

      const lines = result.stdout.trim().split('\n')
      const items: DirectoryEntry[] = []

      for (const line of lines) {
        const match = line.match(/^([dlcbps-])([rwxsStT-]{9})\s+\d+\s+(\S+)\s+(\S+)\s+(\d+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(.+)/)
        if (!match) continue

        const typeChar = match[1]
        const fileName = match[8]

        if (fileName === '.' || fileName === '..') continue

        items.push({
          name: fileName,
          path: dirPath === '/' ? `/${fileName}` : `${dirPath}/${fileName}`,
          type: typeChar === 'd' ? 'directory' : typeChar === 'l' ? 'symlink' : typeChar === '-' ? 'file' : 'other',
          size: parseInt(match[5], 10),
          modifyTimeStr: `${match[6]} ${match[7]}`,
          permissions: match[2],
          owner: '',
          group: '',
        })
      }

      setEntries(items)
    } catch (err: any) {
      setError(err.message || 'Unknown error')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [server])

  useEffect(() => {
    loadDir('/')
  }, [loadDir])

  const navigateTo = (entry: DirectoryEntry) => {
    if (entry.type === 'directory') {
      loadDir(entry.path)
    }
  }

  const goUp = () => {
    const parent = path.split('/').slice(0, -1).join('/') || '/'
    loadDir(parent)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  }

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="fm-overlay" onClick={onClose}>
      <div className="fm-panel" onClick={(e) => e.stopPropagation()}>
        <div className="fm-header">
          <span className="fm-title">{server.name} — 文件管理</span>
          <button className="btn btn-ghost" onClick={onClose}>关闭</button>
        </div>

        <div className="fm-path-bar">
          <button className="btn btn-ghost" onClick={goUp} disabled={path === '/'} style={{ padding: '4px 8px' }}>
            ..
          </button>
          <input
            className="fm-path-input"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') loadDir(path) }}
          />
          <button className="btn btn-ghost" onClick={() => loadDir(path)} style={{ padding: '4px 10px' }}>
            刷新
          </button>
        </div>

        <div className="fm-list">
          <div className="fm-row fm-row-header">
            <span />
            <span>名称</span>
            <span>大小</span>
            <span>修改时间</span>
            <span>权限</span>
          </div>

          {loading ? (
            <div className="fm-loading">加载中...</div>
          ) : error ? (
            <div className="fm-error">{error}</div>
          ) : entries.length === 0 ? (
            <div className="fm-empty-dir">空目录</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.name} className="fm-row" onClick={() => navigateTo(entry)}>
                <span className={`fm-icon ${entry.type === 'directory' ? 'dir' : ''}`}>
                  {entry.type === 'directory' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  )}
                </span>
                <span className="fm-name">{entry.name}</span>
                <span className="fm-size">{entry.type === 'directory' ? '-' : formatSize(entry.size)}</span>
                <span className="fm-date">{entry.modifyTimeStr}</span>
                <span className="fm-perms">{entry.permissions}</span>
              </div>
            ))
          )}
        </div>

        <div className="fm-footer">
          <span>{entries.length} 项</span>
          <span>{path}</span>
        </div>
      </div>
    </div>
  )
}
