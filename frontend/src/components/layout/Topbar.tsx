import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Settings, UserRound } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

interface TopbarProps {
  onMenuClick?: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const navigate = useNavigate()
  const { user, isGuest, logout } = useAuthStore()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="flex h-12 items-center justify-between border-b border-steel-200 bg-white/90 px-3 backdrop-blur-sm sm:px-5">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Открыть меню"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <p className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-steel-400 sm:block">
          Подбор · расчёт · визуализация
        </p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {isGuest && <Badge variant="warning">Гостевой режим</Badge>}
        <div className="flex items-center gap-2 text-sm text-steel-700">
          <UserRound className="h-4 w-4 text-steel-400" />
          <span className="max-w-[8rem] truncate sm:max-w-none">
            {user?.full_name || user?.email || 'Пользователь'}
          </span>
        </div>
        <Link to="/app/settings">
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
