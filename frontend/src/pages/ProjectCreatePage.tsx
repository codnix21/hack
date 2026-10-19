import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Building2, Plane, Hospital, ChevronRight, ChevronLeft } from 'lucide-react'
import { catalogApi } from '../api/catalog'
import { projectsApi } from '../api/projects'
import { getFieldErrors, getFriendlyError } from '../api/client'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Card } from '../components/ui/Card'
import { toastError, toastSuccess } from '../store/toastStore'

type FieldKey = 'name' | 'object_type_id' | 'industry_id' | 'region' | 'work_mode' | 'description'

const FIELD_ORDER: FieldKey[] = ['name', 'object_type_id', 'industry_id', 'region', 'work_mode']

const API_FIELD_MAP: Record<string, FieldKey> = {
  name: 'name',
  object_type_id: 'object_type_id',
  industry_id: 'industry_id',
  region: 'region',
  work_mode: 'work_mode',
  description: 'description',
}

const TYPE_HELP: Record<string, { icon: typeof Building2; blurb: string; depth: string }> = {
  warehouse: {
    icon: Building2,
    blurb: 'Комплектация, транспортировка, паллетные и штучные операции.',
    depth: 'Полный путь: параметры, план, экономика, симуляция.',
  },
  airport: {
    icon: Plane,
    blurb: 'Транспорт грузов и багажа, перрон и терминальные зоны.',
    depth: 'Параметры и подбор доступны; глубина экономики как у общего сценария.',
  },
  medical: {
    icon: Hospital,
    blurb: 'Перевозка белья, питания, медикаментов и отходов внутри здания.',
    depth: 'Параметры и подбор доступны; уточняйте санитарные ограничения.',
  },
}

function typeKey(code?: string | null, name?: string | null): string {
  const c = (code || '').toLowerCase()
  const n = (name || '').toLowerCase()
  if (c.includes('ware') || n.includes('склад')) return 'warehouse'
  if (c.includes('air') || n.includes('аэро')) return 'airport'
  if (c.includes('med') || n.includes('мед')) return 'medical'
  return c || 'other'
}

export function ProjectCreatePage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [wizardStep, setWizardStep] = useState(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [industryId, setIndustryId] = useState('')
  const [objectTypeId, setObjectTypeId] = useState('')
  const [region, setRegion] = useState('')
  const [workMode, setWorkMode] = useState('2shift')
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})

  const nameRef = useRef<HTMLInputElement>(null)

  const industriesQuery = useQuery({
    queryKey: ['industries'],
    queryFn: () => catalogApi.industries(),
  })

  const objectTypesQuery = useQuery({
    queryKey: ['object-types'],
    queryFn: () => catalogApi.objectTypes(),
  })

  const projectQuery = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: isEdit && !!id,
  })

  useEffect(() => {
    const p = projectQuery.data
    if (!p) return
    setName(p.name)
    setDescription(p.description || '')
    setIndustryId(p.industry_id != null ? String(p.industry_id) : '')
    setObjectTypeId(p.object_type_id != null ? String(p.object_type_id) : '')
    setRegion(p.region || '')
    setWorkMode(p.work_mode || '2shift')
    setWizardStep(2)
  }, [projectQuery.data])

  const objectTypes = objectTypesQuery.data || []

  const applyApiError = (e: unknown) => {
    const fieldErrors = getFieldErrors(e)
    const mapped: Partial<Record<FieldKey, string>> = {}
    for (const [key, msg] of Object.entries(fieldErrors)) {
      const local = API_FIELD_MAP[key]
      if (local) mapped[local] = msg
    }
    if (Object.keys(mapped).length) {
      setErrors(mapped)
      const first = FIELD_ORDER.find((k) => mapped[k])
      if (first === 'name') nameRef.current?.focus()
    } else {
      toastError(getFriendlyError(e))
    }
  }

  const validate = (): Partial<Record<FieldKey, string>> => {
    const next: Partial<Record<FieldKey, string>> = {}
    const trimmed = name.trim()
    if (!trimmed) next.name = 'Укажите название проекта'
    else if (trimmed.length < 2) next.name = 'Минимум 2 символа'
    else if (trimmed.length > 120) next.name = 'Максимум 120 символов'
    if (!isEdit && !objectTypeId) next.object_type_id = 'Выберите тип объекта'
    return next
  }

  const createMut = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: (p) => {
      toastSuccess('Проект создан — заполните параметры объекта')
      navigate(`/app/projects/${p.id}?step=object`)
    },
    onError: applyApiError,
  })

  const updateMut = useMutation({
    mutationFn: (payload: Parameters<typeof projectsApi.update>[1]) =>
      projectsApi.update(id!, payload),
    onSuccess: (p) => {
      toastSuccess('Проект обновлён')
      navigate(`/app/projects/${p.id}?step=object`)
    },
    onError: applyApiError,
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length) {
      if (next.object_type_id) setWizardStep(1)
      else nameRef.current?.focus()
      return
    }
    const selected = objectTypes.find((o) => String(o.id) === objectTypeId)
    const ind =
      industryId ||
      (selected?.industry_id != null ? String(selected.industry_id) : '') ||
      (industriesQuery.data?.[0] ? String(industriesQuery.data[0].id) : '')

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      industry_id: ind ? Number(ind) : null,
      object_type_id: objectTypeId ? Number(objectTypeId) : null,
      region: region.trim() || undefined,
      work_mode: workMode || undefined,
    }
    if (isEdit) updateMut.mutate(payload)
    else createMut.mutate(payload)
  }

  const pending = createMut.isPending || updateMut.isPending
  const selectedType = useMemo(
    () => objectTypes.find((o) => String(o.id) === objectTypeId),
    [objectTypes, objectTypeId],
  )

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isEdit ? 'Редактирование проекта' : 'Новый проект'}
        subtitle="Мастер настройки: тип объекта → основные сведения → параметры"
        crumbs={[
          { label: 'Обзор', to: '/app' },
          { label: 'Мои проекты', to: '/app/projects' },
          { label: isEdit ? 'Изменение' : 'Создание' },
        ]}
      />

      <div className="mb-4 flex items-center gap-2 text-sm text-steel-500">
        <span className={wizardStep === 1 ? 'font-semibold text-brand-700' : ''}>1. Тип объекта</span>
        <ChevronRight className="h-4 w-4" />
        <span className={wizardStep === 2 ? 'font-semibold text-brand-700' : ''}>2. Сведения</span>
      </div>

      {wizardStep === 1 && !isEdit && (
        <Card title="Какой объект вы оцениваете?">
          <p className="mb-4 text-sm text-steel-600">
            Выберите тип — от него зависят параметры, доступные решения каталога и глубина сценария.
          </p>
          {objectTypesQuery.isLoading && <p className="text-sm text-steel-500">Загрузка типов…</p>}
          {errors.object_type_id && (
            <p className="mb-3 text-sm text-red-600">{errors.object_type_id}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {objectTypes.map((ot) => {
              const key = typeKey(ot.code, ot.name_ru)
              const help = TYPE_HELP[key] || {
                icon: Building2,
                blurb: ot.name_ru,
                depth: 'Поддержка на уровне параметров и подбора.',
              }
              const Icon = help.icon
              const active = objectTypeId === String(ot.id)
              return (
                <button
                  key={ot.id}
                  type="button"
                  onClick={() => {
                    setObjectTypeId(String(ot.id))
                    if (ot.industry_id != null) setIndustryId(String(ot.industry_id))
                    setErrors((e) => {
                      const n = { ...e }
                      delete n.object_type_id
                      return n
                    })
                  }}
                  className={`rounded border p-4 text-left transition ${
                    active
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-400'
                      : 'border-steel-200 bg-white hover:border-steel-300'
                  }`}
                >
                  <Icon className={`h-6 w-6 ${active ? 'text-brand-600' : 'text-steel-400'}`} />
                  <p className="mt-3 font-display text-base font-semibold text-ink">{ot.name_ru}</p>
                  <p className="mt-1 text-xs text-steel-600">{help.blurb}</p>
                  <p className="mt-2 text-[11px] text-steel-400">{help.depth}</p>
                </button>
              )
            })}
          </div>
          <div className="mt-5 flex justify-end">
            <Button
              type="button"
              disabled={!objectTypeId}
              onClick={() => setWizardStep(2)}
            >
              Далее
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {(wizardStep === 2 || isEdit) && (
        <Card
          title="Основные сведения"
          subtitle={
            selectedType
              ? `Тип объекта: ${selectedType.name_ru}`
              : 'Укажите название — его увидит руководство в отчёте'
          }
        >
          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            {!isEdit && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"
                onClick={() => setWizardStep(1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Изменить тип объекта
              </button>
            )}
            <Input
              ref={nameRef}
              label="Название проекта"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              placeholder="Например: Склад Северный — оценка AMR"
              hint="Обязательное поле"
            />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-steel-700">Описание задачи</span>
              <textarea
                name="description"
                className="min-h-[88px] w-full rounded border border-steel-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-400/40"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Что хотите автоматизировать и какие ограничения важны"
              />
            </label>
            <Input
              label="Регион"
              name="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Например: Москва"
              hint="Необязательно"
            />
            <Select
              label="Режим работы"
              name="work_mode"
              value={workMode}
              onChange={(e) => setWorkMode(e.target.value)}
              options={[
                { value: '1shift', label: '1 смена' },
                { value: '2shift', label: '2 смены' },
                { value: '24x7', label: 'Круглосуточно' },
              ]}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/app/projects')}>
                Отмена
              </Button>
              <Button type="submit" loading={pending}>
                {isEdit ? 'Сохранить' : 'Создать и перейти к данным'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
