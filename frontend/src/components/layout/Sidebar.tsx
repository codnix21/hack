import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  Library,
  GitCompare,
  BarChart3,
  Shield,
  PlayCircle,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const nav = [
  { to: '/app', end: true, label: 'Панель управления', icon: LayoutDashboard },
  { to: '/app/projects', label: 'Мои проекты', icon: FolderKanban },
  { to: '/app/catalog', label: 'Каталог решений', icon: Library },
  { to: '/app/compare', label: 'Сравнение', icon: GitCompare },
  { to: '/app/analytics', label: 'Аналитика', icon: BarChart3 },
  { to: '/app/demo', label: 'Демонстрация', icon: PlayCircle },
]

interface SidebarProps {
  open?: boolean
  onNavigate?: () => void
}

export function Sidebar({ open = false, onNavigate }: SidebarProps) {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'

  return (
    <aside
      className={`app-rail fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
        <span className="brand-mark" aria-hidden>
          РП
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold leading-none tracking-wide text-white">
            РобоПодбор
          </p>
          <p className="mt-1 truncate text-[11px] uppercase tracking-[0.14em] text-steel-500">
            Промышленный контур
          </p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 pt-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition ${
                isActive ? 'nav-item-active' : 'nav-item'
              }`
            }
          >
            <item.icon className="h-4 w-4 shrink-0 opacity-80" />
            {item.label}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/app/admin"
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition ${
                isActive ? 'nav-item-active' : 'nav-item'
              }`
            }
          >
            <Shield className="h-4 w-4 shrink-0 opacity-80" />
            Администрирование
          </NavLink>
        )}
      </nav>
      <div className="border-t border-white/10 px-4 py-3 text-[11px] text-steel-500">
        Каталог · экономика · 2D-схема
      </div>
    </aside>
  )
}
