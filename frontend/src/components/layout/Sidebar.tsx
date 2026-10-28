import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  Library,
  BookOpen,
  Shield,
  PlayCircle,
  PanelLeftClose,
  PanelLeft,
  Settings,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const workNav = [
  { to: '/app', end: true, label: 'Обзор', icon: LayoutDashboard },
  { to: '/app/projects', label: 'Проекты', icon: FolderKanban },
  { to: '/app/catalog', label: 'Каталог роботов', icon: Library },
]

const supportNav = [
  { to: '/app/help', label: 'База знаний', icon: BookOpen },
  { to: '/app/demo', label: 'Примеры', icon: PlayCircle },
]

interface SidebarProps {
  open?: boolean
  collapsed?: boolean
  onToggleCollapse?: () => void
  onNavigate?: () => void
}

function NavItem({
  to,
  end,
  label,
  icon: Icon,
  narrow,
  onNavigate,
  dense,
}: {
  to: string
  end?: boolean
  label: string
  icon: typeof LayoutDashboard
  narrow: boolean
  onNavigate?: () => void
  dense?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      title={label}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-sm text-sm font-medium transition ${
          narrow ? 'justify-center px-2 py-2.5' : dense ? 'px-2.5 py-1.5 text-xs' : 'px-2.5 py-2'
        } ${isActive ? 'nav-item-active' : 'nav-item'}`
      }
    >
      <Icon className={`shrink-0 opacity-80 ${dense ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
      {!narrow && <span className="truncate">{label}</span>}
    </NavLink>
  )
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
      data-testid="app-sidebar"
    >
      <div
        className={`flex items-center border-b border-white/10 ${
          narrow ? 'justify-center px-2 py-3' : 'gap-2.5 px-3 py-3'
        }`}
      >
        <span className="brand-mark shrink-0" aria-hidden>
          NC
        </span>
        {!narrow && (
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold leading-none text-[var(--nc-ink)]">NETCORE</p>
            <p className="mt-0.5 text-[10px] leading-snug text-[var(--nc-muted)]">
              Планирование роботизации
            </p>
          </div>
        )}
        <button
          type="button"
          className="nc-focusable hidden rounded p-1.5 text-[var(--nc-muted)] hover:bg-ink-soft hover:text-[var(--nc-ink)] lg:inline-flex"
          onClick={onToggleCollapse}
          aria-label={narrow ? 'Развернуть меню' : 'Свернуть меню'}
          title={narrow ? 'Развернуть' : 'Свернуть'}
        >
          {narrow ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto p-1.5 pt-3" aria-label="Основное меню">
        <div>
          {!narrow && (
            <p className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--nc-text)]">
              Работа
            </p>
          )}
          <div className="space-y-0.5">
            {workNav.map((item) => (
              <NavItem key={item.to} {...item} narrow={narrow} onNavigate={onNavigate} />
            ))}
          </div>
        </div>

        <div>
          {!narrow && (
            <p className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--nc-text)]">
              Справка
            </p>
          )}
          <div className="space-y-0.5">
            {supportNav.map((item) => (
              <NavItem
                key={item.to}
                {...item}
                narrow={narrow}
                onNavigate={onNavigate}
                dense={item.to === '/app/demo'}
              />
            ))}
          </div>
        </div>

        {isAdmin && (
          <div>
            {!narrow && (
              <p className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--nc-text)]">
                Система
              </p>
            )}
            <NavItem
              to="/app/admin"
              label="Администрирование"
              icon={Shield}
              narrow={narrow}
              onNavigate={onNavigate}
            />
          </div>
        )}
      </nav>

      <div className={`border-t border-white/10 ${narrow ? 'p-1.5' : 'p-2'}`}>
        <NavItem
          to="/app/settings"
          label="Настройки"
          icon={Settings}
          narrow={narrow}
          onNavigate={onNavigate}
          dense
        />
        {!narrow && (
          <p className="mt-2 px-1.5 text-[10px] leading-relaxed text-[var(--nc-muted)]">
            Оценка не заменяет обследование объекта
          </p>
        )}
      </div>
    </aside>
  )
}
