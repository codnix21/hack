import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  Library,
  HelpCircle,
  Shield,
  PlayCircle,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const primaryNav = [
  { to: '/app', end: true, label: 'Обзор', icon: LayoutDashboard },
  { to: '/app/projects', label: 'Проекты', icon: FolderKanban },
  { to: '/app/catalog', label: 'Каталог решений', icon: Library },
  { to: '/app/help', label: 'Справка', icon: HelpCircle },
]

interface SidebarProps {
  open?: boolean
  collapsed?: boolean
  onToggleCollapse?: () => void
  onNavigate?: () => void
}

export function Sidebar({
  open = false,
  collapsed = false,
  onToggleCollapse,
  onNavigate,
}: SidebarProps) {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const narrow = collapsed

  return (
    <aside
      className={`app-rail fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col transition-[width,transform] duration-200 lg:static lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      } ${narrow ? 'w-14' : 'w-56'}`}
    >
      <div className={`flex items-center border-b border-white/10 ${narrow ? 'justify-center px-2 py-3' : 'gap-2.5 px-3 py-3'}`}>
        <span className="brand-mark shrink-0" aria-hidden>
          NC
        </span>
        {!narrow && (
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold leading-none text-white">NETCORE</p>
            <p className="mt-0.5 text-[10px] leading-snug text-steel-500">Оценка роботизации</p>
          </div>
        )}
        <button
          type="button"
          className="nc-focusable hidden rounded p-1.5 text-steel-500 hover:bg-ink-soft hover:text-steel-200 lg:inline-flex"
          onClick={onToggleCollapse}
          aria-label={narrow ? 'Развернуть меню' : 'Свернуть меню'}
          title={narrow ? 'Развернуть' : 'Свернуть'}
        >
          {narrow ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-1.5 pt-2" aria-label="Основное меню">
        {primaryNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            title={item.label}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-sm text-sm font-medium transition ${
                narrow ? 'justify-center px-2 py-2.5' : 'px-2.5 py-2'
              } ${isActive ? 'nav-item-active' : 'nav-item'}`
            }
          >
            <item.icon className="h-4 w-4 shrink-0 opacity-80" />
            {!narrow && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
        <NavLink
          to="/app/demo"
          onClick={onNavigate}
          title="Демонстрация"
          className={({ isActive }) =>
            `mt-3 flex items-center gap-2.5 rounded-sm text-xs font-medium transition ${
              narrow ? 'justify-center px-2 py-2' : 'px-2.5 py-1.5'
            } ${isActive ? 'nav-item-active' : 'nav-item'}`
          }
        >
          <PlayCircle className="h-3.5 w-3.5 shrink-0 opacity-80" />
          {!narrow && 'Демонстрация'}
        </NavLink>
        {isAdmin && (
          <NavLink
            to="/app/admin"
            onClick={onNavigate}
            title="Администрирование"
            className={({ isActive }) =>
              `mt-0.5 flex items-center gap-2.5 rounded-sm text-sm font-medium transition ${
                narrow ? 'justify-center px-2 py-2.5' : 'px-2.5 py-2'
              } ${isActive ? 'nav-item-active' : 'nav-item'}`
            }
          >
            <Shield className="h-4 w-4 shrink-0 opacity-80" />
            {!narrow && <span className="truncate">Администрирование</span>}
          </NavLink>
        )}
      </nav>
      {!narrow && (
        <div className="border-t border-white/10 p-2.5">
          <p className="px-1.5 text-[10px] leading-relaxed text-steel-600">
            Не замена обследования объекта
          </p>
        </div>
      )}
    </aside>
  )
}
