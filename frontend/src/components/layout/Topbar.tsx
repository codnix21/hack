import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Moon, Settings, Sun, UserRound } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { Button } from '../ui/Button'
import { StatusPill } from '../ui/StatusPill'

interface TopbarProps {
  onMenuClick?: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const navigate = useNavigate()
  const { user, isGuest, logout } = useAuthStore()
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header
      className="flex shrink-0 items-center justify-between border-b border-[var(--nc-border-subtle)] bg-[var(--nc-bg-elevated)]/95 px-3 backdrop-blur sm:px-4"
      style={{ height: 'var(--nc-topbar-h)' }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Открыть меню"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <p className="nc-meta hidden truncate lg:block">
          Предынвестиционная оценка · план · экономика · симуляция
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          data-testid="theme-toggle"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="hidden sm:inline">{theme === 'dark' ? 'Светлая' : 'Тёмная'}</span>
        </Button>
        {isGuest && (
          <StatusPill tone="warning" title="Гостевая сессия ограничена по сроку">
            Гость
          </StatusPill>
        )}
        <div className="flex min-w-0 items-center gap-1.5 text-sm text-[var(--nc-text)]">
          <UserRound className="h-4 w-4 shrink-0 text-[var(--nc-muted)]" aria-hidden />
          <span className="max-w-[7rem] truncate sm:max-w-[12rem] text-[var(--nc-ink)]">
            {user?.full_name || user?.email || 'Пользователь'}
          </span>
        </div>
        <Link to="/app/settings" className="lg:hidden">
          <Button variant="ghost" size="sm" aria-label="Настройки">
            <Settings className="h-4 w-4" />
          </Button>
        </Link>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Выйти</span>
        </Button>
      </div>
    </header>
  )
}
