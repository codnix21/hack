import { useEffect, useState } from 'react'
import { useBlocker, type BlockerFunction } from 'react-router-dom'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

export type UnsavedGuardAction = 'stay' | 'discard' | 'save'

interface Props {
  /** Блокировать уход со страницы при несохранённых изменениях */
  when: boolean
  /** Сохранить и затем продолжить переход. При ошибке не вызывать proceed. */
  onSaveAndLeave: () => Promise<void>
  /** После успешного discard (перед proceed) — опционально сбросить локальное состояние */
  onDiscard?: () => void
  title?: string
  description?: string
}

/**
 * Единый guard для SPA-навигации + beforeunload при закрытии вкладки.
 * Не показывает window.confirm — только свой диалог (без двойных окон с beforeunload).
 * Блокирует только смену pathname (смена ?step= внутри workspace разрешена).
 */
export function UnsavedChangesGuard({
  when,
  onSaveAndLeave,
  onDiscard,
  title = 'Несохранённые изменения',
  description = 'Параметры объекта изменены, но не сохранены. Что сделать перед уходом?',
}: Props) {
  const [saving, setSaving] = useState(false)

  const shouldBlock: BlockerFunction = ({ currentLocation, nextLocation }) =>
    when && currentLocation.pathname !== nextLocation.pathname

  const blocker = useBlocker(shouldBlock)

  // Закрытие вкладки / обновление — нативный диалог браузера (не наш Modal).
  // SPA-переходы обрабатывает только useBlocker → Modal (без beforeunload).
  useEffect(() => {
    if (!when) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [when])

  useEffect(() => {
    if (blocker.state === 'blocked' && !when) {
      blocker.reset()
    }
  }, [blocker, when])

  const stay = () => {
    if (blocker.state === 'blocked') blocker.reset()
  }

  const discard = () => {
    onDiscard?.()
    if (blocker.state === 'blocked') blocker.proceed()
  }

  const saveAndLeave = async () => {
    if (blocker.state !== 'blocked') return
    setSaving(true)
    try {
      await onSaveAndLeave()
      blocker.proceed()
    } catch {
      // dirty сохраняется; остаёмся на странице
      blocker.reset()
    } finally {
      setSaving(false)
    }
  }

  const open = blocker.state === 'blocked'

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : stay}
      title={title}
      size="md"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={stay}
            disabled={saving}
            data-testid="unsaved-stay"
          >
            Остаться
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={discard}
            disabled={saving}
            data-testid="unsaved-discard"
          >
            Не сохранять
          </Button>
          <Button
            type="button"
            loading={saving}
            onClick={() => void saveAndLeave()}
            data-testid="unsaved-save"
          >
            Сохранить и перейти
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-steel-700" data-testid="unsaved-guard-dialog">
        {description}
      </p>
    </Modal>
  )
}
