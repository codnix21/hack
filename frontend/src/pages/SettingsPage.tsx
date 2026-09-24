import { useAuthStore } from '../store/authStore'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'

export function SettingsPage() {
  const { user, isGuest } = useAuthStore()

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Настройки"
        subtitle="Профиль пользователя и параметры сессии"
        crumbs={[
          { label: 'Панель управления', to: '/app' },
          { label: 'Настройки' },
        ]}
      />
      <Card title="Профиль">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-steel-500">ФИО</dt>
            <dd className="font-medium">{user?.full_name || 'Не указано'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-steel-500">Электронная почта</dt>
            <dd className="font-medium">{user?.email || 'Не указано'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-steel-500">Роль</dt>
            <dd>
              <Badge variant={user?.role === 'admin' ? 'info' : 'default'}>
                {user?.role === 'admin'
                  ? 'Администратор'
                  : user?.role === 'guest'
                    ? 'Гость'
                    : 'Пользователь'}
              </Badge>
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-steel-500">Режим</dt>
            <dd className="font-medium">{isGuest ? 'Гостевой' : 'Авторизованный'}</dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}
