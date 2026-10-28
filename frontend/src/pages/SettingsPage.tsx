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
            <dt className="text-[var(--nc-muted)]">ФИО</dt>
            <dd className="font-medium">{user?.full_name || 'Не указано'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--nc-muted)]">Электронная почта</dt>
            <dd className="font-medium">{user?.email || 'Не указано'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--nc-muted)]">Роль</dt>
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
            <dt className="text-[var(--nc-muted)]">Режим</dt>
            <dd className="font-medium">{isGuest ? 'Гостевой' : 'Авторизованный'}</dd>
          </div>
        </dl>
        {isGuest && (
          <p className="mt-4 rounded border border-[rgba(245,193,74,0.4)] bg-[var(--nc-warning-soft)] px-3 py-2 text-sm text-amber-900">
            Гостевая сессия: можно создавать и редактировать свои проекты (включая план DXF,
            подбор и экономику). Общие примеры только для просмотра — сделайте копию.
            Срок хранения временный; зарегистрируйтесь для постоянного хранения.
            {user?.expires_at
              ? ` Действует до ${new Date(user.expires_at).toLocaleDateString('ru-RU')}.`
              : ''}
          </p>
        )}
      </Card>
    </div>
  )
}
