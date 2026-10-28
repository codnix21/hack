import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const COLLAPSE_KEY = 'nc-sidebar-collapsed'

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <div className="flex min-h-screen bg-[var(--nc-bg)]">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-ink/50 lg:hidden"
          aria-label="Закрыть меню"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar
        open={sidebarOpen}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        onNavigate={() => setSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} />
        <main className="app-main flex-1 overflow-auto">
          <div className="app-main-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
