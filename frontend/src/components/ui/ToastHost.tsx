import { X } from 'lucide-react'
import { useToastStore } from '../../store/toastStore'

export function ToastHost() {
  const { toasts, remove } = useToastStore()

  if (!toasts.length) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded border px-4 py-3 shadow-lift ${
            t.type === 'error'
              ? 'border-red-300 bg-red-50 text-red-900'
              : t.type === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                : 'border-steel-300 bg-white text-steel-900'
          }`}
        >
          <p className="flex-1 text-sm">{t.message}</p>
          <button type="button" onClick={() => remove(t.id)} aria-label="Закрыть уведомление">
            <X className="h-4 w-4 opacity-60" />
          </button>
        </div>
      ))}
    </div>
  )
}
