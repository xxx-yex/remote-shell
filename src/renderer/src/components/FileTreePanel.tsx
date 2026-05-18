import { useState, useEffect, useCallback, useRef } from 'react'
import type { ServerConfig, DirectoryEntry } from '../../shared/types'

interface UploadNotify {
  id: string
  fileName: string
  serverName: string
  remoteDir: string
  status: 'uploading' | 'success' | 'error'
  progress: number
  fileSize: number
  errorMsg?: string
}

interface FileCtx {
  x: number
  y: number
  server: ServerConfig
  entry: DirectoryEntry
  parentPath: string
}

interface InputModal {
  title: string
  defaultValue: string
  onConfirm: (value: string) => void
}

interface ConfirmDelete {
  server: ServerConfig
  entry: DirectoryEntry
  parentPath: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function typeLabel(t: DirectoryEntry['type']): string {
  switch (t) {
    case 'directory': return '文件夹'
    case 'file': return '文件'
    case 'symlink': return '链接'
    default: return '其他'
  }
}

interface Props {
  server: ServerConfig | null
  syncPath?: string | null
  onPathChange?: () => void
}

export default function FileTreePanel({ server, syncPath, onPathChange }: Props) {
  const [currentPath, setCurrentPath] = useState('/')
  const [dirCache, setDirCache] = useState<Record<string, DirectoryEntry[]>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [panelHeight, setPanelHeight] = useState(240)
  const resizing = useRef(false)
  const [dropTarget, setDropTarget] = useState(false)
  const [notifications, setNotifications] = useState<UploadNotify[]>([])
  const [fileCtx, setFileCtx] = useState<FileCtx | null>(null)
  const [inputModal, setInputModal] = useState<InputModal | null>(null)
  const [confirmFileDelete, setConfirmFileDelete] = useState<ConfirmDelete | null>(null)
  const [sortKey, setSortKey] = useState<'name' | 'size' | 'type' | 'time'>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [pathInput, setPathInput] = useState('/')
  const [pathEditing, setPathEditing] = useState(false)
  const pathInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)
  const currentServerId = useRef<string | null>(null)

  // Upload progress listener
  useEffect(() => {
    const off = window.api.onSshUploadProgress((uploadId, transferred, total) => {
      const pct = total > 0 ? Math.round((transferred / total) * 100) : 0
      setNotifications((prev) =>
        prev.map((n) => n.id === uploadId ? { ...n, progress: pct } : n),
      )
    })
    return off
  }, [])

  // Load root when server changes
  useEffect(() => {
    if (!server) return
    if (currentServerId.current !== server.id) {
      currentServerId.current = server.id
      setDirCache({})
      setLoading({})
      setCurrentPath('/')
      setPathInput('/')
      loadDir(server, '/')
    }
  }, [server?.id])

  // Sync path from terminal cd command
  useEffect(() => {
    if (syncPath && server) {
      navigateTo(server, syncPath)
      setPathInput(syncPath)
      onPathChange?.()
    }
  }, [syncPath])

  // Auto-focus path input when editing
  useEffect(() => {
    if (pathEditing && pathInputRef.current) {
      pathInputRef.current.focus()
      pathInputRef.current.select()
    }
  }, [pathEditing])

  // Resize handler
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = panelHeight
    resizing.current = true

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return
      const delta = startY - ev.clientY
      setPanelHeight(Math.max(100, Math.min(500, startH + delta)))
    }
    const onUp = () => {
      resizing.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [panelHeight])

  // Close context menu on click / Escape
  useEffect(() => {
    if (!fileCtx) return
    const close = () => setFileCtx(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('click', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [fileCtx])

  const dismissNotify = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const loadDir = useCallback(async (srv: ServerConfig, dirPath: string) => {
    const cacheKey = `${srv.id}:${dirPath}`
    setLoading((prev) => ({ ...prev, [cacheKey]: true }))
    try {
      const result = await window.api.sshExec(srv, `ls -la "${dirPath}" 2>/dev/null`)
      const lines = result.stdout.trim().split('\n')
      const items: DirectoryEntry[] = []
      for (const line of lines) {
        const parts = line.split(/\s+/)
        if (parts.length < 9) continue
        const perm = parts[0]
        const typeChar = perm[0]
        if (!/[dlcbps-]/.test(typeChar)) continue
        const nameIdx = /^\d{4}-/.test(parts[5]) ? 7 : 8
        if (parts.length <= nameIdx) continue
        let fileName = parts.slice(nameIdx).join(' ')
        const arrowIdx = fileName.indexOf(' -> ')
        if (arrowIdx !== -1) fileName = fileName.substring(0, arrowIdx)
        if (fileName === '.' || fileName === '..') continue

        const dateStr = nameIdx === 7
          ? `${parts[5]} ${parts[6]}`
          : `${parts[5]} ${parts[6]} ${parts[7]}`

        items.push({
          name: fileName,
          path: dirPath === '/' ? `/${fileName}` : `${dirPath}/${fileName}`,
          type: typeChar === 'd' ? 'directory' : typeChar === 'l' ? 'symlink' : typeChar === '-' ? 'file' : 'other',
          size: parseInt(parts[4], 10),
          modifyTimeStr: dateStr,
          permissions: perm.substring(1, 10),
          owner: parts[2],
          group: parts[3],
        })
      }

      // Directories first, then alphabetical
      items.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1
        if (a.type !== 'directory' && b.type === 'directory') return 1
        return a.name.localeCompare(b.name)
      })

      setDirCache((prev) => ({ ...prev, [cacheKey]: items }))
    } catch {
      setDirCache((prev) => ({ ...prev, [cacheKey]: [] }))
    } finally {
      setLoading((prev) => ({ ...prev, [cacheKey]: false }))
    }
  }, [])

  const navigateTo = (srv: ServerConfig | null, path: string) => {
    if (!srv) return
    setCurrentPath(path)
    setPathInput(path)
    setPathEditing(false)
    const cacheKey = `${srv.id}:${path}`
    if (!dirCache[cacheKey]) {
      loadDir(srv, path)
    }
  }

  const getParentPath = (entryPath: string) => {
    if (entryPath === '/') return '/'
    const idx = entryPath.lastIndexOf('/')
    return idx <= 0 ? '/' : entryPath.substring(0, idx)
  }

  // Sort entries
  const getSortedEntries = (entries: DirectoryEntry[]): DirectoryEntry[] => {
    return [...entries].sort((a, b) => {
      // Directories always first
      if (a.type === 'directory' && b.type !== 'directory') return -1
      if (a.type !== 'directory' && b.type === 'directory') return 1
      let cmp = 0
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'size': cmp = a.size - b.size; break
        case 'type': cmp = a.type.localeCompare(b.type); break
        case 'time': cmp = a.modifyTimeStr.localeCompare(b.modifyTimeStr); break
      }
      return sortAsc ? cmp : -cmp
    })
  }

  // === File operations ===

  const handleDownload = async () => {
    if (!fileCtx) return
    const { server: srv, entry } = fileCtx
    setFileCtx(null)
    try {
      await window.api.sshDownload(srv, entry.path)
    } catch { /* user cancelled or error */ }
  }

  const handleRename = () => {
    if (!fileCtx) return
    const { entry, server: srv, parentPath } = fileCtx
    setFileCtx(null)
    setInputModal({
      title: '重命名',
      defaultValue: entry.name,
      onConfirm: async (newName) => {
        if (newName === entry.name) return
        const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`
        try {
          await window.api.sshExec(srv, `mv "${entry.path}" "${newPath}"`)
          loadDir(srv, parentPath)
        } catch { /* ignore */ }
      },
    })
  }

  const handleDelete = () => {
    if (!fileCtx) return
    setConfirmFileDelete({ server: fileCtx.server, entry: fileCtx.entry, parentPath: fileCtx.parentPath })
    setFileCtx(null)
  }

  const confirmFileDeleteExec = async () => {
    if (!confirmFileDelete) return
    const { server: srv, entry, parentPath } = confirmFileDelete
    const cmd = entry.type === 'directory' ? `rm -rf "${entry.path}"` : `rm -f "${entry.path}"`
    try {
      await window.api.sshExec(srv, cmd)
      loadDir(srv, parentPath)
    } catch { /* ignore */ }
    setConfirmFileDelete(null)
  }

  const handleNewFile = () => {
    if (!server) return
    const targetDir = fileCtx?.entry.type === 'directory' ? fileCtx.entry.path : currentPath
    setFileCtx(null)
    setInputModal({
      title: '新建文件',
      defaultValue: '',
      onConfirm: async (name) => {
        if (!name || !server) return
        try {
          await window.api.sshExec(server, `touch "${targetDir === '/' ? '' : targetDir}/${name}"`)
          loadDir(server, targetDir)
        } catch { /* ignore */ }
      },
    })
  }

  const handleNewFolder = () => {
    if (!server) return
    const targetDir = fileCtx?.entry.type === 'directory' ? fileCtx.entry.path : currentPath
    setFileCtx(null)
    setInputModal({
      title: '新建文件夹',
      defaultValue: '',
      onConfirm: async (name) => {
        if (!name || !server) return
        try {
          await window.api.sshExec(server, `mkdir -p "${targetDir === '/' ? '' : targetDir}/${name}"`)
          loadDir(server, targetDir)
        } catch { /* ignore */ }
      },
    })
  }

  const handleRefresh = () => {
    if (!server) return
    const dir = fileCtx?.entry.type === 'directory' ? fileCtx.entry.path : currentPath
    setFileCtx(null)
    const cacheKey = `${server.id}:${dir}`
    setDirCache((prev) => { const n = { ...prev }; delete n[cacheKey]; return n })
    loadDir(server, dir)
  }

  const handleCopyPath = () => {
    if (!fileCtx) return
    window.api.clipboardWrite(fileCtx.entry.path)
    setFileCtx(null)
  }

  // === Drag & drop ===

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(false)
    dragCounter.current = 0
    if (!server) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    for (const file of files) {
      const uploadId = crypto.randomUUID()
      const remotePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`
      const notify: UploadNotify = {
        id: uploadId,
        fileName: file.name,
        serverName: server.name,
        remoteDir: currentPath,
        status: 'uploading',
        progress: 0,
        fileSize: file.size,
      }
      setNotifications((prev) => [...prev, notify])
      try {
        const localPath = window.api.getPathForFile(file)
        if (!localPath) throw new Error('无法获取本地文件路径')
        await window.api.sshUpload(server, localPath, remotePath, uploadId)
        setNotifications((prev) =>
          prev.map((n) => n.id === uploadId ? { ...n, status: 'success', progress: 100 } : n),
        )
        setTimeout(() => dismissNotify(uploadId), 4000)
      } catch (err: any) {
        setNotifications((prev) =>
          prev.map((n) => n.id === uploadId ? { ...n, status: 'error', errorMsg: err?.message || String(err) } : n),
        )
        setTimeout(() => dismissNotify(uploadId), 8000)
      }
    }
    loadDir(server, currentPath)
  }, [server, currentPath, loadDir])

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    setDropTarget(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setDropTarget(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const onItemCtx = (e: React.MouseEvent, entry: DirectoryEntry) => {
    e.preventDefault()
    e.stopPropagation()
    if (!server) return
    setFileCtx({
      x: e.clientX,
      y: e.clientY,
      server,
      entry,
      parentPath: getParentPath(entry.path),
    })
  }

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const sortIcon = (key: typeof sortKey) => {
    if (sortKey !== key) return null
    return sortAsc ? ' ▲' : ' ▼'
  }

  if (!server) return null

  const cacheKey = `${server.id}:${currentPath}`
  const entries = dirCache[cacheKey]
  const isLoading = loading[cacheKey]
  const isFile = fileCtx?.entry.type !== 'directory'

  return (
    <>
      <div className="file-tree-panel" style={{ height: panelHeight }}>
        <div className="file-tree-resize-handle" onMouseDown={handleResizeMouseDown} />
        <div className="file-tree-header">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="file-tree-title">文件管理</span>
          <span className="tree-drop-hint">拖拽文件到此区域上传</span>
        </div>
        <div
            className={`file-tree-content ${dropTarget ? 'drop-active' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Path input bar */}
            <div className="file-path-bar">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <input
                ref={pathInputRef}
                className="file-path-input"
                value={pathEditing ? pathInput : currentPath}
                onChange={(e) => setPathInput(e.target.value)}
                onFocus={() => { setPathEditing(true); setPathInput(currentPath) }}
                onBlur={() => {
                  if (pathEditing && pathInput.trim() && pathInput.trim() !== currentPath) {
                    navigateTo(server, pathInput.trim())
                  }
                  setPathEditing(false)
                  setPathInput(currentPath)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && pathInput.trim()) {
                    navigateTo(server, pathInput.trim())
                  }
                  if (e.key === 'Escape') {
                    setPathInput(currentPath)
                    setPathEditing(false)
                    e.currentTarget.blur()
                  }
                }}
              />
            </div>

            {/* Table header */}
            <div className="file-table-header">
              <div className="file-col file-col-name" onClick={() => handleSort('name')}>
                文件名{sortIcon('name')}
              </div>
              <div className="file-col file-col-size" onClick={() => handleSort('size')}>
                大小{sortIcon('size')}
              </div>
              <div className="file-col file-col-type" onClick={() => handleSort('type')}>
                类型{sortIcon('type')}
              </div>
              <div className="file-col file-col-time" onClick={() => handleSort('time')}>
                修改时间{sortIcon('time')}
              </div>
              <div className="file-col file-col-perm">权限</div>
              <div className="file-col file-col-owner">用户/用户组</div>
            </div>

            {/* Table body */}
            <div className="file-table-body">
              {/* Go up entry */}
              {currentPath !== '/' && (
                <div
                  className="file-row"
                  onDoubleClick={() => navigateTo(server, getParentPath(currentPath))}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    // No context menu for ".."
                  }}
                >
                  <div className="file-col file-col-name">
                    <svg className="tree-icon dir" width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <span className="file-name-text">..</span>
                  </div>
                  <div className="file-col file-col-size" />
                  <div className="file-col file-col-type" />
                  <div className="file-col file-col-time" />
                  <div className="file-col file-col-perm" />
                  <div className="file-col file-col-owner" />
                </div>
              )}

              {isLoading && !entries && (
                <div className="file-loading">加载中...</div>
              )}

              {entries && getSortedEntries(entries).map((entry) => {
                const isDir = entry.type === 'directory'
                return (
                  <div
                    key={entry.path}
                    className="file-row"
                    onDoubleClick={() => isDir && navigateTo(server, entry.path)}
                    onContextMenu={(e) => onItemCtx(e, entry)}
                  >
                    <div className="file-col file-col-name">
                      <svg className={`tree-icon ${isDir ? 'dir' : 'file'}`} width="14" height="14" viewBox="0 0 24 24" fill="none">
                        {isDir ? (
                          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke="currentColor" strokeWidth="1.5" />
                        ) : (
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" />
                        )}
                      </svg>
                      <span className="file-name-text" title={entry.path}>{entry.name}</span>
                    </div>
                    <div className="file-col file-col-size">{isDir ? '' : formatSize(entry.size)}</div>
                    <div className="file-col file-col-type">{typeLabel(entry.type)}</div>
                    <div className="file-col file-col-time">{entry.modifyTimeStr}</div>
                    <div className="file-col file-col-perm">{entry.permissions}</div>
                    <div className="file-col file-col-owner" title={`${entry.owner}/${entry.group}`}>{entry.owner}/{entry.group}</div>
                  </div>
                )
              })}
            </div>
        </div>
      </div>

      {/* File context menu */}
      {fileCtx && (
        <div className="ctx-menu" style={{ left: fileCtx.x, top: fileCtx.y }} onClick={(e) => e.stopPropagation()}>
          {isFile && (
            <button className="ctx-item" onClick={handleDownload}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              下载到本地
            </button>
          )}
          <button className="ctx-item" onClick={handleNewFile}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5"/><path d="M12 12v6m-3-3h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            新建文件
          </button>
          <button className="ctx-item" onClick={handleNewFolder}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke="currentColor" strokeWidth="1.5"/><path d="M12 12v6m-3-3h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            新建文件夹
          </button>
          <div className="ctx-divider" />
          <button className="ctx-item" onClick={handleRename}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 20h16M8.5 16.5L18 7l-2-2-9.5 9.5L5 17l1.5-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            重命名
          </button>
          <button className="ctx-item ctx-item--danger" onClick={handleDelete}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v12a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            删除
          </button>
          <div className="ctx-divider" />
          <button className="ctx-item" onClick={handleRefresh}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            刷新
          </button>
          <button className="ctx-item" onClick={handleCopyPath}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5"/></svg>
            复制路径
          </button>
        </div>
      )}

      {/* File delete confirmation */}
      {confirmFileDelete && (
        <div className="modal-overlay" onClick={() => setConfirmFileDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">确认删除？</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: 4, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
              {confirmFileDelete.entry.path}
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--red)', marginBottom: 16 }}>
              {confirmFileDelete.entry.type === 'directory' ? '将删除整个目录及其所有内容' : '此文件将被永久删除'}
            </p>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmFileDelete(null)}>取消</button>
              <button className="btn btn-danger" onClick={confirmFileDeleteExec}>删除</button>
            </div>
          </div>
        </div>
      )}

      {/* Input modal */}
      {inputModal && (
        <InputModalComponent
          title={inputModal.title}
          defaultValue={inputModal.defaultValue}
          onConfirm={inputModal.onConfirm}
          onCancel={() => setInputModal(null)}
        />
      )}

      {/* Upload notifications */}
      {notifications.length > 0 && (
        <div className="upload-notifications">
          {notifications.map((n) => (
            <div key={n.id} className={`upload-notify upload-notify--${n.status}`}>
              <div className="upload-notify-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
                <span className="upload-notify-name" title={n.fileName}>{n.fileName}</span>
                <button className="upload-notify-close" onClick={() => dismissNotify(n.id)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              </div>
              <div className="upload-notify-meta">{n.serverName} : {n.remoteDir}</div>
              {n.status === 'uploading' && (
                <div className="upload-notify-bar">
                  <div className="upload-notify-fill" style={{ width: `${n.progress}%` }} />
                </div>
              )}
              <div className="upload-notify-footer">
                {n.status === 'uploading' && <span>{n.progress}% · {formatSize(n.fileSize)}</span>}
                {n.status === 'success' && <span className="upload-notify-success">上传完成</span>}
                {n.status === 'error' && <span className="upload-notify-error">上传失败{n.errorMsg ? `：${n.errorMsg}` : ''}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function InputModalComponent({ title, defaultValue, onConfirm, onCancel }: {
  title: string
  defaultValue: string
  onConfirm: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(defaultValue)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      onConfirm(value.trim())
      onCancel()
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-title">{title}</div>
          <div className="form-group">
            <input
              ref={ref}
              className="form-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={!value.trim()}>确定</button>
          </div>
        </form>
      </div>
    </div>
  )
}
