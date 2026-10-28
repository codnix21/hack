import { ArrowRight } from 'lucide-react'
import type { NextStepSuggestion } from '../../utils/nextStep'
import type { EconomicsFreshnessStatus } from '../../utils/economicsFreshness'
import { ECONOMICS_FRESHNESS_LABEL } from '../../utils/economicsFreshness'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

interface Props {
  suggestion: NextStepSuggestion
  /** Текущий step URL — если совпадает с рекомендованным, CTA скрываем */
  currentStep: string
  freshness: EconomicsFreshnessStatus
  onGo: (step: string) => void
  className?: string
}

/**
 * Компактная полоса: что готово / что дальше / свежесть экономики.
 * Не дублирует тяжёлые панели диагностики.
 */
export function ProjectGuidanceBar({
  suggestion,
  currentStep,
  freshness,
  onGo,
  className = '',
}: Props) {
  const onRecommendedStep = currentStep === suggestion.step
  const freshnessVariant =
    freshness === 'fresh' ? 'success' : freshness === 'stale' ? 'warning' : 'default'

  return (
    <div
      className={`nc-panel flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 ${className}`}
      data-testid="project-guidance-bar"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--nc-ink)]">{suggestion.title}</p>
        <p className="mt-0.5 text-sm leading-snug text-[var(--nc-text)]">{suggestion.reason}</p>
      </div>
      <Badge variant={freshnessVariant} className="shrink-0">
        Экономика: {ECONOMICS_FRESHNESS_LABEL[freshness]}
      </Badge>
      {!onRecommendedStep && (
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => onGo(suggestion.step)}
          data-testid="project-guidance-cta"
        >
          {suggestion.ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
